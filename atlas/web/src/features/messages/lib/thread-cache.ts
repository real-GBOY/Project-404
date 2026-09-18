import type { MessageDto, MessageHistoryPage, MessageSyncResult } from "../contracts/messaging-types";

/**
 * The client-side copy of one conversation's messages — a pure data structure with
 * pure functions over it, so the reconciliation rules (the part that must be right
 * for realtime + reconnect to be trustworthy) are unit-testable without React or a
 * socket.
 *
 * Rules, all of which exist because delivery is at-least-once and unordered across
 * paths (socket broadcast, REST history, REST resync can all carry the same message):
 *  - identity is the message `id`; applying the same message twice is a no-op;
 *  - the higher `changeSeq` wins — a stale copy (an old broadcast arriving after a
 *    resync) can never overwrite a newer edit/delete;
 *  - display order is the immutable creation `seq`, never arrival order;
 *  - `lastChangeSeq` only moves forward, and is the cursor for the next resync.
 */
export interface ThreadCache {
  /** Oldest → newest by `seq`. Deleted messages stay as tombstones. */
  messages: MessageDto[];
  /** Pass as `before` to load older history; `null` once the start of the conversation is loaded. */
  olderCursor: number | null;
  /** Highest `changeSeq` folded in — where the next resync starts. */
  lastChangeSeq: number;
}

export const emptyThread = (): ThreadCache => ({ messages: [], olderCursor: null, lastChangeSeq: 0 });

export function threadFromHistory(page: MessageHistoryPage): ThreadCache {
  return { messages: page.messages, olderCursor: page.olderCursor, lastChangeSeq: page.lastChangeSeq };
}

/** Insert or update one message. Returns the SAME object when nothing changed (cheap for React). */
export function upsertMessage(thread: ThreadCache, incoming: MessageDto): ThreadCache {
  const index = thread.messages.findIndex((m) => m.id === incoming.id);
  const lastChangeSeq = Math.max(thread.lastChangeSeq, incoming.changeSeq);

  if (index >= 0) {
    if (thread.messages[index]!.changeSeq >= incoming.changeSeq) {
      return lastChangeSeq === thread.lastChangeSeq ? thread : { ...thread, lastChangeSeq };
    }
    const messages = thread.messages.slice();
    messages[index] = incoming;
    return { ...thread, messages, lastChangeSeq };
  }

  // A message older than the loaded window that we don't already hold would render as an island
  // above a gap. It will arrive with the rest of its page when the user scrolls up.
  const oldest = thread.messages[0];
  if (oldest && thread.olderCursor !== null && incoming.seq < oldest.seq) {
    return lastChangeSeq === thread.lastChangeSeq ? thread : { ...thread, lastChangeSeq };
  }

  const messages = thread.messages.slice();
  let at = messages.length;
  while (at > 0 && messages[at - 1]!.seq > incoming.seq) at--;
  messages.splice(at, 0, incoming);
  return { ...thread, messages, lastChangeSeq };
}

/** Tombstone a message in place (the body is gone server-side; mirror that). */
export function applyDeletion(
  thread: ThreadCache,
  d: { messageId: string; changeSeq: number; deletedAt: string },
): ThreadCache {
  const existing = thread.messages.find((m) => m.id === d.messageId);
  const lastChangeSeq = Math.max(thread.lastChangeSeq, d.changeSeq);
  if (!existing || existing.changeSeq >= d.changeSeq) {
    return lastChangeSeq === thread.lastChangeSeq ? thread : { ...thread, lastChangeSeq };
  }
  return upsertMessage(thread, {
    ...existing,
    body: "",
    attachments: [],
    deletedAt: d.deletedAt,
    updatedAt: d.deletedAt,
    changeSeq: d.changeSeq,
  });
}

/** Prepend an older page (scroll-up). Dedupes by id; tolerant of overlap. */
export function prependHistory(thread: ThreadCache, page: MessageHistoryPage): ThreadCache {
  const known = new Map(thread.messages.map((m) => [m.id, m]));
  const fresh = page.messages.filter((m) => !known.has(m.id));
  const messages = [...fresh, ...thread.messages].sort((a, b) => a.seq - b.seq);
  return { messages, olderCursor: page.olderCursor, lastChangeSeq: Math.max(thread.lastChangeSeq, page.lastChangeSeq) };
}

/** Fold in one page of a resync (creates, edits, deletes, reactions since the cursor). */
export function applySync(thread: ThreadCache, result: Pick<MessageSyncResult, "messages" | "lastChangeSeq" | "hasMore">): ThreadCache {
  let next = thread;
  for (const m of result.messages) next = upsertMessage(next, m);
  // Only advance to the server's head once we have consumed everything up to it.
  const consumed = result.hasMore ? Math.max(0, ...result.messages.map((m) => m.changeSeq)) : result.lastChangeSeq;
  return consumed > next.lastChangeSeq ? { ...next, lastChangeSeq: consumed } : next;
}

/**
 * Reconnect reconciliation for one conversation: page through `sync` from the
 * cached cursor until the server says there is nothing more, folding each page in.
 *
 * It never works from a snapshot. Socket events keep arriving WHILE these requests
 * are in flight, so each page is applied to the CURRENT cache through `write`
 * (a functional update), and the cursor for the next request is re-read from the
 * cache each time - otherwise a message delivered mid-resync would be overwritten
 * by a result computed from the state before it existed. `fetchPage` is injected so
 * this stays free of HTTP and React.
 */
export async function resyncThread(
  io: {
    read: () => ThreadCache | undefined;
    write: (update: (current: ThreadCache) => ThreadCache) => void;
    fetchPage: (afterChangeSeq: number) => Promise<MessageSyncResult>;
  },
  maxPages = 20,
): Promise<{ members: MessageSyncResult["members"] | null }> {
  let members: MessageSyncResult["members"] | null = null;
  for (let page = 0; page < maxPages; page++) {
    const before = io.read();
    if (!before) break; // the thread was closed/evicted meanwhile
    const result = await io.fetchPage(before.lastChangeSeq);
    members = result.members;
    io.write((current) => applySync(current, result));
    const after = io.read();
    if (!result.hasMore) break;
    // Guard: a page that made no progress would loop forever.
    if (!after || after.lastChangeSeq <= before.lastChangeSeq) break;
  }
  return { members };
}
