import { describe, expect, it } from "vitest";
import type { MessageDto, MessageSyncResult } from "../contracts/messaging-types";
import { applyDeletion, applySync, emptyThread, prependHistory, resyncThread, upsertMessage, type ThreadCache } from "./thread-cache";

const msg = (seq: number, over: Partial<MessageDto> = {}): MessageDto => ({
  id: `m${seq}`,
  conversationId: "c1",
  senderId: "u1",
  body: `body ${seq}`,
  messageType: "text",
  clientMessageId: null,
  replyToMessageId: null,
  seq,
  changeSeq: seq,
  createdAt: `2026-09-18T10:00:${String(seq).padStart(2, "0")}.000Z`,
  updatedAt: `2026-09-18T10:00:${String(seq).padStart(2, "0")}.000Z`,
  editedAt: null,
  deletedAt: null,
  metadata: {},
  attachments: [],
  reactions: [],
  ...over,
});

const thread = (...ms: MessageDto[]): ThreadCache => ({
  messages: ms,
  olderCursor: null,
  lastChangeSeq: Math.max(0, ...ms.map((m) => m.changeSeq)),
});

describe("upsertMessage — at-least-once, unordered delivery", () => {
  it("applying the same message twice changes nothing (same object back)", () => {
    const t = upsertMessage(emptyThread(), msg(1));
    expect(upsertMessage(t, msg(1))).toBe(t);
    expect(t.messages).toHaveLength(1);
  });

  it("orders by creation seq, not arrival order", () => {
    let t = emptyThread();
    for (const s of [3, 1, 2]) t = upsertMessage(t, msg(s));
    expect(t.messages.map((m) => m.seq)).toEqual([1, 2, 3]);
  });

  it("the higher changeSeq wins — a stale broadcast never overwrites a newer edit", () => {
    const edited = msg(1, { body: "edited", changeSeq: 9, editedAt: "2026-09-18T11:00:00Z" });
    const t = upsertMessage(thread(edited), msg(1, { body: "original", changeSeq: 1 }));
    expect(t.messages[0]!.body).toBe("edited");
    expect(upsertMessage(thread(msg(1)), edited).messages[0]!.body).toBe("edited");
  });

  it("lastChangeSeq only moves forward", () => {
    const t = upsertMessage(thread(msg(5)), msg(2, { changeSeq: 2 }));
    expect(t.lastChangeSeq).toBe(5);
  });

  it("does not create an island above an unloaded gap (older than the loaded window, not held)", () => {
    const windowed: ThreadCache = { messages: [msg(10), msg(11)], olderCursor: 10, lastChangeSeq: 11 };
    const t = upsertMessage(windowed, msg(3, { changeSeq: 50 }));
    expect(t.messages.map((m) => m.seq)).toEqual([10, 11]);
    expect(t.lastChangeSeq).toBe(50); // the cursor still advances
  });

  it("but does apply a change to an OLD message we already hold", () => {
    const windowed: ThreadCache = { messages: [msg(10), msg(11)], olderCursor: 10, lastChangeSeq: 11 };
    const t = upsertMessage(windowed, msg(10, { body: "reacted", changeSeq: 20 }));
    expect(t.messages[0]!.body).toBe("reacted");
  });
});

describe("applyDeletion", () => {
  it("tombstones the message: body and attachments gone, kept in place", () => {
    const withFile = msg(2, { attachments: [{ id: "a", fileId: "f", fileName: "x.pdf", contentType: "application/pdf", byteSize: 1 }] });
    const t = applyDeletion(thread(msg(1), withFile, msg(3)), { messageId: "m2", changeSeq: 40, deletedAt: "2026-09-18T12:00:00Z" });
    const dead = t.messages[1]!;
    expect(dead).toMatchObject({ id: "m2", body: "", attachments: [], deletedAt: "2026-09-18T12:00:00Z" });
    expect(t.messages).toHaveLength(3);
    expect(t.lastChangeSeq).toBe(40);
  });

  it("an old deletion event cannot un-do or re-apply over a newer state", () => {
    const t0 = thread(msg(2, { changeSeq: 99 }));
    const t = applyDeletion(t0, { messageId: "m2", changeSeq: 40, deletedAt: "x" });
    expect(t.messages[0]!.deletedAt).toBeNull();
  });

  it("deleting a message we never loaded is harmless", () => {
    const t0 = thread(msg(1));
    expect(applyDeletion(t0, { messageId: "nope", changeSeq: 2, deletedAt: "x" }).messages).toHaveLength(1);
  });
});

describe("prependHistory (scroll up)", () => {
  it("prepends older messages, dedupes overlap, moves the cursor", () => {
    const t0: ThreadCache = { messages: [msg(5), msg(6)], olderCursor: 5, lastChangeSeq: 6 };
    const t = prependHistory(t0, { messages: [msg(3), msg(4), msg(5)], olderCursor: 3, lastChangeSeq: 6 });
    expect(t.messages.map((m) => m.seq)).toEqual([3, 4, 5, 6]);
    expect(t.olderCursor).toBe(3);
  });

  it("reaches the start of the conversation", () => {
    const t = prependHistory({ messages: [msg(2)], olderCursor: 2, lastChangeSeq: 2 }, { messages: [msg(1)], olderCursor: null, lastChangeSeq: 2 });
    expect(t.olderCursor).toBeNull();
  });
});

describe("resync after a reconnect", () => {
  const page = (messages: MessageDto[], lastChangeSeq: number, hasMore = false): MessageSyncResult => ({ messages, lastChangeSeq, hasMore, members: [] });

  it("applySync folds creates, edits and deletes in, and lands on the server's head cursor", () => {
    const t0 = thread(msg(1), msg(2));
    const t = applySync(t0, {
      messages: [msg(3), msg(1, { body: "one!", changeSeq: 4 }), msg(2, { body: "", deletedAt: "d", changeSeq: 5 })],
      lastChangeSeq: 5,
      hasMore: false,
    });
    expect(t.messages.map((m) => m.body)).toEqual(["one!", "", "body 3"]);
    expect(t.messages[1]!.deletedAt).toBe("d");
    expect(t.lastChangeSeq).toBe(5);
  });

  it("does NOT jump to the server head while more pages remain (would skip changes)", () => {
    const t = applySync(thread(msg(1)), { messages: [msg(2)], lastChangeSeq: 99, hasMore: true });
    expect(t.lastChangeSeq).toBe(2);
  });

  /** An in-memory stand-in for the query cache. */
  const cache = (initial: ThreadCache | undefined) => {
    let value = initial;
    return {
      read: () => value,
      write: (update: (t: ThreadCache) => ThreadCache) => {
        if (value) value = update(value);
      },
      get value() {
        return value;
      },
    };
  };

  it("pages until the server says there is nothing more, from the cached cursor each time", async () => {
    const seen: number[] = [];
    const pages = [page([msg(2), msg(3)], 6, true), page([msg(4), msg(5), msg(6)], 6, false)];
    const c = cache(thread(msg(1)));
    await resyncThread({ read: c.read, write: c.write, fetchPage: async (after) => { seen.push(after); return pages.shift()!; } });
    expect(seen).toEqual([1, 3]); // second request resumes where the first page ended
    expect(c.value!.messages.map((m) => m.seq)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(c.value!.lastChangeSeq).toBe(6);
  });

  it("is idempotent - resyncing what the socket already delivered changes nothing", async () => {
    const t0 = thread(msg(1), msg(2));
    const c = cache(t0);
    await resyncThread({ read: c.read, write: c.write, fetchPage: async () => page([msg(2)], 2) });
    expect(c.value!.messages).toEqual(t0.messages);
  });

  it("KEEPS a message the socket delivers while the resync request is in flight (no stale overwrite)", async () => {
    const c = cache(thread(msg(1)));
    await resyncThread({
      read: c.read,
      write: c.write,
      fetchPage: async () => {
        // a live event lands during the round trip...
        c.write((t) => upsertMessage(t, msg(4, { body: "arrived mid-resync" })));
        // ...and the server answer (computed earlier) does not contain it.
        return page([msg(2)], 2);
      },
    });
    expect(c.value!.messages.map((m) => m.body)).toEqual(["body 1", "body 2", "arrived mid-resync"]);
    expect(c.value!.lastChangeSeq).toBe(4);
  });

  it("stops quietly if the thread is closed while resyncing", async () => {
    let value: ThreadCache | undefined = thread(msg(1));
    const io = {
      read: () => value,
      write: (u: (t: ThreadCache) => ThreadCache) => { if (value) value = u(value); },
      fetchPage: async () => { value = undefined; return page([msg(2)], 2, true); },
    };
    await expect(resyncThread(io)).resolves.toEqual({ members: [] });
  });

  it("cannot loop forever on a server that makes no progress", async () => {
    let calls = 0;
    const c = cache(thread(msg(1)));
    await resyncThread({ read: c.read, write: c.write, fetchPage: async () => { calls++; return page([], 1, true); } });
    expect(calls).toBe(1);
  });

  it("returns the fresh member list so read cursors missed offline reconcile too", async () => {
    const members = [{ userId: "u2", displayName: "Sara", role: "member" as const, joinedAt: "j", leftAt: null, lastReadMessageId: "m2", lastReadAt: "r" }];
    const c = cache(thread(msg(1)));
    const out = await resyncThread({ read: c.read, write: c.write, fetchPage: async () => ({ ...page([], 1), members }) });
    expect(out.members).toEqual(members);
  });
});
