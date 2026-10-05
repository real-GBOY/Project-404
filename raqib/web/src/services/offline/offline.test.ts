import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Inspection } from "@/api/types";
import { applyOp, applyOps } from "./apply";
import { createIdb } from "./idb";
import { isNetworkError, isRetryable, Outbox, type Executor, type Op } from "./outbox";
import { OfflineSession } from "./session";

let n = 0;
/** A brand-new database per call (no shared state between tests). */
const fresh = async () => createIdb(`raqib-offline-test-${++n}`);

const recorder = (fail?: (op: Op) => unknown): { exec: Executor; calls: string[] } => {
  const calls: string[] = [];
  const run = (label: string, op: Op) => {
    const err = fail?.(op);
    if (err) throw err;
    calls.push(label);
  };
  return {
    calls,
    exec: {
      answer: async (op) => run(`answer:${op.itemId}:${JSON.stringify(op.patch)}`, op),
      guardScore: async (op) => run(`score:${op.guardId}:${op.itemId}=${op.score}`, op),
      guardNote: async (op) => run(`note:${op.guardId}:${op.note}`, op),
      evidence: async (op, file) => run(`evidence:${file.name}:${file.size}:${op.itemId}`, op),
      submit: async (op) => run(`submit:${op.visitId}`, op),
    },
  };
};

describe("Outbox", () => {
  let idb: Awaited<ReturnType<typeof fresh>>;
  let box: Outbox;
  beforeEach(async () => {
    idb = await fresh();
    box = new Outbox(idb, "usr_a", () => 1_000);
  });

  it("replays changes in the order they were made", async () => {
    await box.enqueue({ kind: "answer", visitId: "v1", itemId: "i1", patch: { value: "c" } });
    await box.enqueue({ kind: "guardScore", visitId: "v1", guardId: "g1", itemId: "k1", score: 4 });
    await box.enqueue({ kind: "answer", visitId: "v1", itemId: "i2", patch: { value: "n" } });
    await box.enqueue({ kind: "submit", visitId: "v1" });
    const { exec, calls } = recorder();
    const r = await box.flush(exec);
    expect(calls).toEqual([
      'answer:i1:{"value":"c"}',
      "score:g1:k1=4",
      'answer:i2:{"value":"n"}',
      "submit:v1",
    ]);
    expect(r).toMatchObject({ done: 4, failed: 0, stalled: false, visits: ["v1"] });
    expect(await box.list()).toEqual([]);
  });

  it("merges repeated edits to the same thing so a long offline stretch replays short", async () => {
    await box.enqueue({ kind: "answer", visitId: "v1", itemId: "i1", patch: { value: "c" } });
    await box.enqueue({ kind: "answer", visitId: "v1", itemId: "i1", patch: { note: "first" } });
    await box.enqueue({
      kind: "answer",
      visitId: "v1",
      itemId: "i1",
      patch: { note: "second", severity: "high" },
    });
    await box.enqueue({ kind: "guardScore", visitId: "v1", guardId: "g1", itemId: "k1", score: 2 });
    await box.enqueue({ kind: "guardScore", visitId: "v1", guardId: "g1", itemId: "k1", score: 5 });
    await box.enqueue({ kind: "guardNote", visitId: "v1", guardId: "g1", note: "a" });
    await box.enqueue({ kind: "guardNote", visitId: "v1", guardId: "g1", note: "ab" });
    await box.enqueue({ kind: "submit", visitId: "v1" });
    await box.enqueue({ kind: "submit", visitId: "v1" });
    const { exec, calls } = recorder();
    await box.flush(exec);
    expect(calls).toEqual([
      'answer:i1:{"value":"c","note":"second","severity":"high"}',
      "score:g1:k1=5",
      "note:g1:ab",
      "submit:v1",
    ]);
  });

  it("stops at an unreachable network, keeps everything, and carries on from where it stopped", async () => {
    await box.enqueue({ kind: "answer", visitId: "v1", itemId: "i1", patch: { value: "c" } });
    await box.enqueue({ kind: "answer", visitId: "v1", itemId: "i2", patch: { value: "c" } });
    await box.enqueue({ kind: "answer", visitId: "v1", itemId: "i3", patch: { value: "c" } });
    let down = true;
    const { exec, calls } = recorder((op) =>
      down && op.kind === "answer" && op.itemId === "i2" ? new TypeError("Failed to fetch") : null,
    );
    const first = await box.flush(exec);
    expect(first).toMatchObject({ done: 1, stalled: true });
    expect(calls).toHaveLength(1);
    expect((await box.list()).map((o) => (o as { itemId: string }).itemId)).toEqual(["i2", "i3"]);
    expect((await box.list())[0]!.attempts).toBe(1);

    down = false;
    const second = await box.flush(exec);
    expect(second).toMatchObject({ done: 2, stalled: false });
    expect(calls.slice(1)).toEqual(['answer:i2:{"value":"c"}', 'answer:i3:{"value":"c"}']);
  });

  it("marks a change the server refuses for good as failed, does not block the rest, and keeps it for the person to see", async () => {
    await box.enqueue({ kind: "answer", visitId: "v1", itemId: "locked", patch: { value: "c" } });
    await box.enqueue({ kind: "answer", visitId: "v1", itemId: "ok", patch: { value: "c" } });
    const { exec, calls } = recorder((op) =>
      op.kind === "answer" && op.itemId === "locked"
        ? Object.assign(new Error("This inspection is locked."), {
            status: 409,
            code: "raqib.inspection_locked",
          })
        : null,
    );
    const r = await box.flush(exec);
    expect(r).toMatchObject({ done: 1, failed: 1, stalled: false });
    expect(calls).toEqual(['answer:ok:{"value":"c"}']);
    const left = await box.list();
    expect(left).toHaveLength(1);
    expect(left[0]!.failed).toEqual({
      code: "raqib.inspection_locked",
      message: "This inspection is locked.",
    });
    expect(await box.counts()).toEqual({ pending: 0, failed: 1 });
    // a failed change is not retried, and can be discarded
    expect((await box.flush(exec)).done).toBe(0);
    expect(await box.discardFailed()).toBe(1);
    expect(await box.list()).toEqual([]);
  });

  it("treats an expired session (401) as 'try later', not as a refusal", async () => {
    await box.enqueue({ kind: "submit", visitId: "v1" });
    const { exec } = recorder(() => Object.assign(new Error("expired"), { status: 401 }));
    const r = await box.flush(exec);
    expect(r.stalled).toBe(true);
    expect((await box.list())[0]!.failed).toBeUndefined();
  });

  it("keeps queued photos on the device and uploads the bytes with the right name, then removes them", async () => {
    const file = new Blob(["abcdef"], { type: "image/png" });
    const stored = await box.enqueueFile(
      file,
      { visitId: "v1", inspectionId: "insp1", itemId: "i1" },
      "gate.png",
      "image/png",
    );
    if (stored.kind !== "evidence") throw new Error("expected an evidence change");
    expect((await idb.blobGet(stored.blobKey))?.size).toBe(6);
    const { exec, calls } = recorder();
    expect((await box.flush(exec)).done).toBe(1);
    expect(calls).toEqual(["evidence:gate.png:6:i1"]);
    expect(await idb.blobGet(stored.blobKey)).toBeUndefined();
  });

  it("discarding a queued photo also frees its bytes", async () => {
    const q = await box.enqueueFile(
      new Blob(["xyz"]),
      { visitId: "v1", inspectionId: "insp1", guardId: "g1" },
      "a.jpg",
      "image/jpeg",
    );
    await box.discard(q.seq);
    if (q.kind === "evidence") expect(await idb.blobGet(q.blobKey)).toBeUndefined();
    expect(await box.list()).toEqual([]);
  });

  it("never shows or sends another person's changes", async () => {
    await box.enqueue({ kind: "answer", visitId: "v1", itemId: "i1", patch: { value: "c" } });
    const other = new Outbox(idb, "usr_b", () => 2_000);
    expect(await other.list()).toEqual([]);
    const { exec, calls } = recorder();
    await other.flush(exec);
    expect(calls).toEqual([]);
    expect(await box.counts()).toEqual({ pending: 1, failed: 0 });
  });

  it("knows which failures are the network's fault", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkError(Object.assign(new Error("network"), {}))).toBe(true);
    expect(isNetworkError(Object.assign(new Error("bad gateway"), { status: 502 }))).toBe(true);
    expect(isNetworkError(Object.assign(new Error("conflict"), { status: 409 }))).toBe(false);
    expect(isRetryable(Object.assign(new Error("too many"), { status: 429 }))).toBe(true);
    expect(isRetryable(Object.assign(new Error("nope"), { status: 400 }))).toBe(false);
  });
});

describe("applyOp", () => {
  const view = {
    id: "insp",
    sections: [
      {
        key: "s",
        title: { ar: "", en: "" },
        items: [
          { id: "i1", answer: null, note: "", severity: null },
          { id: "i2", answer: "c", note: "", severity: null },
        ],
      },
    ],
    guards: [{ guardId: "g1", scores: { k1: 3 }, note: "" }],
  } as unknown as Inspection;

  it("shows queued answers, scores and notes on the view without touching the original", () => {
    const out = applyOps(view, [
      {
        kind: "answer",
        visitId: "v",
        itemId: "i1",
        patch: { value: "n", note: "gap in the fence", severity: "high" },
      },
      { kind: "guardScore", visitId: "v", guardId: "g1", itemId: "k1", score: 5 },
      { kind: "guardNote", visitId: "v", guardId: "g1", note: "late" },
    ]);
    expect(out.sections[0]!.items[0]).toMatchObject({
      answer: "n",
      note: "gap in the fence",
      severity: "high",
    });
    expect(out.sections[0]!.items[1]).toMatchObject({ answer: "c" });
    expect(out.guards[0]).toMatchObject({ scores: { k1: 5 }, note: "late" });
    expect(view.sections[0]!.items[0]).toMatchObject({ answer: null });
  });

  it("leaves the view alone for changes the server must accept first (evidence, submit)", () => {
    expect(applyOp(view, { kind: "submit", visitId: "v" })).toBe(view);
  });
});

describe("OfflineSession", () => {
  const user = async (fetchImpl: typeof fetch) => {
    const s = new OfflineSession(fetchImpl, () => createIdb(`raqib-offline-test-${++n}`));
    await s.setUser("usr_a");
    return s;
  };

  it("queues while offline or while earlier changes wait, and sends directly otherwise", async () => {
    const s = await user(vi.fn() as never);
    expect(await s.shouldQueue("v1")).toBe(false);
    s.reportNetworkFailure();
    expect(s.isOnline()).toBe(false);
    expect(await s.shouldQueue("v1")).toBe(true);
    await s.queue({ kind: "submit", visitId: "v1" });
    expect(s.getSnapshot()).toMatchObject({ online: false, pending: 1 });
  });

  it("comes back online by probing the server, then sends what was waiting", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("down"))
      .mockResolvedValue({ ok: true } as Response);
    const s = await user(fetchImpl as never);
    const { exec, calls } = recorder();
    const flushed: number[] = [];
    const stop = s.start(exec, (r) => flushed.push(r.done));
    await s.queue({ kind: "answer", visitId: "v1", itemId: "i1", patch: { value: "c" } });
    s.reportNetworkFailure();
    expect(await s.probe()).toBe(false); // the server is still unreachable: nothing is sent
    expect(calls).toEqual([]);
    expect(await s.probe()).toBe(true); // reachable again: online, and the waiting change goes out
    await s.flush();
    expect(s.isOnline()).toBe(true);
    expect(calls).toEqual(['answer:i1:{"value":"c"}']);
    expect(s.getSnapshot()).toMatchObject({ online: true, pending: 0 });
    expect(flushed).toContain(1);
    stop();
  });

  it("stays offline when the probe fails", async () => {
    const s = await user(vi.fn().mockRejectedValue(new TypeError("down")) as never);
    expect(await s.probe()).toBe(false);
    expect(s.isOnline()).toBe(false);
  });

  it("serves the last remembered copy when the network is down, and never hides a real server error", async () => {
    const s = await user(vi.fn() as never);
    expect(await s.withCache("visits", async () => ["v1"])).toEqual(["v1"]);
    expect(await s.withCache("visits", async () => Promise.reject(new TypeError("down")))).toEqual([
      "v1",
    ]);
    expect(s.isOnline()).toBe(false);
    await expect(
      s.withCache("visits", async () =>
        Promise.reject(Object.assign(new Error("forbidden"), { status: 403 })),
      ),
    ).rejects.toThrow("forbidden");
    await expect(
      s.withCache("never-seen", async () => Promise.reject(new TypeError("down"))),
    ).rejects.toBeInstanceOf(TypeError);
  });

  it("keeps each person's cache apart and forgets it on sign-out, but not their unsent changes", async () => {
    const s = await user(vi.fn() as never);
    await s.cacheWrite("visits", ["mine"]);
    await s.queue({ kind: "submit", visitId: "v1" });
    await s.clearCache();
    expect(await s.cacheRead("visits")).toBeUndefined();
    await s.setUser("usr_b");
    expect(s.getSnapshot().pending).toBe(0); // someone else's queue is not mine
    await s.setUser("usr_a");
    expect(s.getSnapshot().pending).toBe(1); // and it is still waiting for its owner
  });
});
