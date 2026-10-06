import type { Answer } from "@/api/types";
import type { Idb } from "./idb";

/** One change made while there was no connection (or while earlier changes were still waiting). */
export type Op =
  | {
      kind: "answer";
      visitId: string;
      itemId: string;
      patch: {
        value?: Answer | null;
        note?: string | null;
        severity?: "low" | "medium" | "high" | null;
      };
    }
  | { kind: "guardScore"; visitId: string; guardId: string; itemId: string; score: number }
  | { kind: "guardNote"; visitId: string; guardId: string; note: string }
  | {
      kind: "evidence";
      visitId: string;
      inspectionId: string;
      itemId?: string | null;
      guardId?: string | null;
      blobKey: string;
      name: string;
      type: string;
      size: number;
    }
  | { kind: "submit"; visitId: string };

export type StoredOp = Op & {
  seq: number;
  userId: string;
  at: number;
  attempts: number;
  /** Set when the server refused the change for good (it will never succeed by retrying). */
  failed?: { code: string; message: string };
};

/** What flushing needs from the application: one function per kind of change, each throwing on failure. */
export interface Executor {
  answer(op: Extract<Op, { kind: "answer" }>): Promise<void>;
  guardScore(op: Extract<Op, { kind: "guardScore" }>): Promise<void>;
  guardNote(op: Extract<Op, { kind: "guardNote" }>): Promise<void>;
  evidence(op: Extract<Op, { kind: "evidence" }>, file: File): Promise<void>;
  submit(op: Extract<Op, { kind: "submit" }>): Promise<void>;
}

export interface FlushResult {
  done: number;
  failed: number;
  /** True when the flush stopped because the network (or the session) was not usable; try again later. */
  stalled: boolean;
  /** Visits that had changes applied, so their server state can be re-read. */
  visits: string[];
}

/** Thrown by an upload that could not go out now and was kept on the device to be sent later. */
export class QueuedUpload extends Error {
  constructor(readonly blobKey: string) {
    super("upload queued");
    this.name = "QueuedUpload";
  }
}

/** A failure that means "try again later", never "this change is wrong". */
export function isRetryable(err: unknown): boolean {
  if (err instanceof TypeError) return true; // fetch could not reach the server
  const e = err as { message?: string; status?: number } | null;
  if (e?.message === "network" || e?.message === "aborted") return true; // XHR upload
  const s = e?.status;
  return s === 401 || s === 408 || s === 425 || s === 429 || (typeof s === "number" && s >= 500);
}

export const isNetworkError = (err: unknown): boolean => {
  if (err instanceof TypeError) return true;
  const e = err as { message?: string; status?: number } | null;
  return e?.message === "network" || e?.status === 502 || e?.status === 503 || e?.status === 504;
};

const key = (o: Op): string =>
  o.kind === "answer"
    ? `a:${o.visitId}:${o.itemId}`
    : o.kind === "guardScore"
      ? `s:${o.visitId}:${o.guardId}:${o.itemId}`
      : o.kind === "guardNote"
        ? `n:${o.visitId}:${o.guardId}`
        : o.kind === "submit"
          ? `x:${o.visitId}`
          : "";

/**
 * The durable queue behind offline work. Changes are applied to the server in the order they were made. Consecutive
 * edits to the same thing are merged while they wait (typing a note twice sends it once; the last score wins; a second
 * "submit" is not queued), so a long offline stretch replays as a short, meaningful list rather than every keystroke.
 */
export class Outbox {
  constructor(
    private readonly idb: Idb,
    private readonly userId: string,
    private readonly clock: () => number = Date.now,
  ) {}

  async list(): Promise<StoredOp[]> {
    return (await this.idb.outboxAll<StoredOp>())
      .filter((o) => o.userId === this.userId)
      .sort((a, b) => a.seq - b.seq);
  }

  async counts(): Promise<{ pending: number; failed: number }> {
    const all = await this.list();
    return {
      pending: all.filter((o) => !o.failed).length,
      failed: all.filter((o) => o.failed).length,
    };
  }

  async hasPending(visitId?: string): Promise<boolean> {
    return (await this.list()).some((o) => !o.failed && (!visitId || o.visitId === visitId));
  }

  async enqueue(op: Op): Promise<StoredOp> {
    const all = await this.list();
    const k = key(op);
    if (k) {
      const same = all.find((o) => !o.failed && key(o) === k);
      if (same) {
        // merge into the waiting change; it keeps its place in the order (and for a submit nothing changes)
        const merged: StoredOp =
          op.kind === "answer" && same.kind === "answer"
            ? { ...same, patch: { ...same.patch, ...op.patch } }
            : op.kind === "submit"
              ? same
              : ({
                  ...same,
                  ...op,
                  seq: same.seq,
                  userId: same.userId,
                  at: this.clock(),
                  attempts: 0,
                } as StoredOp);
        await this.idb.outboxPut(merged);
        return merged;
      }
    }
    const stored = { ...op, userId: this.userId, at: this.clock(), attempts: 0 } as Omit<
      StoredOp,
      "seq"
    >;
    const seq = await this.idb.outboxAdd(stored);
    return { ...stored, seq } as StoredOp;
  }

  /** Queue a file: its bytes go to the blob store, the change to the outbox. Returns the queued change. */
  async enqueueFile(
    file: Blob,
    meta: {
      visitId: string;
      inspectionId: string;
      itemId?: string | null;
      guardId?: string | null;
    },
    name: string,
    type: string,
  ): Promise<StoredOp> {
    const blobKey = `${this.userId}:${this.clock()}-${Math.random().toString(36).slice(2, 8)}`;
    await this.idb.blobPut(blobKey, file);
    return this.enqueue({ kind: "evidence", ...meta, name, type, size: file.size, blobKey });
  }

  async discard(seq: number): Promise<void> {
    const op = (await this.list()).find((o) => o.seq === seq);
    if (op?.kind === "evidence") await this.idb.blobDelete(op.blobKey);
    await this.idb.outboxDelete(seq);
  }

  async discardFailed(): Promise<number> {
    const failed = (await this.list()).filter((o) => o.failed);
    for (const o of failed) await this.discard(o.seq);
    return failed.length;
  }

  async discardAll(): Promise<void> {
    for (const o of await this.list()) await this.discard(o.seq);
  }

  /**
   * Send everything waiting, oldest first. A change the server refuses for good is marked failed and skipped (it must not
   * block the rest); a change that fails because the network or session is unusable stops the run, to be tried again.
   */
  async flush(exec: Executor): Promise<FlushResult> {
    const result: FlushResult = { done: 0, failed: 0, stalled: false, visits: [] };
    for (const op of await this.list()) {
      if (op.failed) continue;
      try {
        if (op.kind === "answer") await exec.answer(op);
        else if (op.kind === "guardScore") await exec.guardScore(op);
        else if (op.kind === "guardNote") await exec.guardNote(op);
        else if (op.kind === "submit") await exec.submit(op);
        else {
          const blob = await this.idb.blobGet(op.blobKey);
          if (!blob)
            throw Object.assign(new Error("The queued file is no longer on this device."), {
              status: 410,
              code: "offline.file_missing",
            });
          await exec.evidence(op, new File([blob], op.name, { type: op.type }));
          await this.idb.blobDelete(op.blobKey);
        }
        await this.idb.outboxDelete(op.seq);
        result.done += 1;
        if (!result.visits.includes(op.visitId)) result.visits.push(op.visitId);
      } catch (err) {
        if (isRetryable(err)) {
          await this.idb.outboxPut({ ...op, attempts: op.attempts + 1 });
          result.stalled = true;
          return result;
        }
        const e = err as { code?: string; message?: string };
        await this.idb.outboxPut({
          ...op,
          attempts: op.attempts + 1,
          failed: { code: e.code ?? "error", message: e.message ?? "The change was refused." },
        });
        result.failed += 1;
      }
    }
    return result;
  }
}
