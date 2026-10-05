import { useSyncExternalStore } from "react";
import { API_BASE_URL } from "@/config/env";
import { createIdb, type Idb } from "./idb";
import {
  Outbox,
  isNetworkError,
  type Executor,
  type FlushResult,
  type Op,
  type StoredOp,
} from "./outbox";

export interface SyncState {
  online: boolean;
  /** Changes waiting to be sent. */
  pending: number;
  /** Changes the server refused; they stay listed until the person discards them. */
  failed: number;
  syncing: boolean;
}

const PROBE_MS = 10_000;
const RETRY_MS = 20_000;

/**
 * Connectivity, the offline outbox and the offline read cache for the signed-in person, in one place.
 *
 * "Online" is not just `navigator.onLine` (a phone on a weak mast says yes and cannot reach anything): any request that
 * fails with a network error marks us offline, and a light probe of the health endpoint brings us back. While offline —
 * or while earlier changes are still waiting, so order is kept — inspection edits are queued on the device and replayed
 * when the connection returns. Everything is scoped to the user id; one person's queue is never sent as another.
 */
export class OfflineSession {
  private idb: Idb | undefined;
  private outbox: Outbox | null = null;
  private userId: string | null = null;
  private executor: Executor | null = null;
  private onFlushed: ((r: FlushResult) => void) | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;
  private flushing: Promise<FlushResult | undefined> | null = null;
  private listeners = new Set<() => void>();
  private snapshot: SyncState = {
    online: typeof navigator === "undefined" ? true : navigator.onLine,
    pending: 0,
    failed: 0,
    syncing: false,
  };

  constructor(
    private readonly fetchImpl: typeof fetch = (...a) => fetch(...a),
    private readonly makeIdb: () => Idb = () => createIdb(),
  ) {}

  private db(): Idb {
    return (this.idb ??= this.makeIdb());
  }

  // ── store for React ───────────────────────────────────────────────────
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = (): SyncState => this.snapshot;
  private set(patch: Partial<SyncState>): void {
    const next = { ...this.snapshot, ...patch };
    if (
      next.online === this.snapshot.online &&
      next.pending === this.snapshot.pending &&
      next.failed === this.snapshot.failed &&
      next.syncing === this.snapshot.syncing
    )
      return;
    this.snapshot = next;
    this.listeners.forEach((l) => l());
  }

  // ── lifecycle ─────────────────────────────────────────────────────────
  /** Bind to a person (their outbox and cache). Call with null on sign-out. */
  async setUser(userId: string | null): Promise<void> {
    if (userId === this.userId) return;
    this.userId = userId;
    this.outbox = userId ? new Outbox(this.db(), userId) : null;
    await this.refreshCounts();
  }

  start(executor: Executor, onFlushed: (r: FlushResult) => void): () => void {
    this.executor = executor;
    this.onFlushed = onFlushed;
    const goOnline = () => void this.probe();
    const goOffline = () => this.set({ online: false });
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    document.addEventListener("visibilitychange", goOnline);
    this.timer = setInterval(() => void this.tick(), PROBE_MS);
    void this.tick();
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      document.removeEventListener("visibilitychange", goOnline);
      if (this.timer) clearInterval(this.timer);
      this.timer = undefined;
      this.executor = null;
      this.onFlushed = null;
    };
  }

  isOnline(): boolean {
    return this.snapshot.online;
  }

  /** A request failed because the network is unusable. */
  reportNetworkFailure(): void {
    this.set({ online: false });
  }

  private async tick(): Promise<void> {
    if (!this.snapshot.online) await this.probe();
    else if (this.snapshot.pending > 0 && !this.snapshot.syncing) await this.flush();
  }

  /** Is the server reachable? If so we are online and anything waiting is sent. */
  async probe(): Promise<boolean> {
    try {
      const res = await this.fetchImpl(`${API_BASE_URL}/health`, { cache: "no-store" });
      if (!res.ok) throw new TypeError("unhealthy");
      this.set({ online: true });
      await this.flush();
      return true;
    } catch {
      this.set({ online: false });
      return false;
    }
  }

  // ── outbox ────────────────────────────────────────────────────────────
  async refreshCounts(): Promise<void> {
    const c = this.outbox ? await this.outbox.counts() : { pending: 0, failed: 0 };
    this.set(c);
  }

  /** Queue instead of sending when offline, or when this visit already has changes waiting (order must be kept). */
  async shouldQueue(visitId: string): Promise<boolean> {
    if (!this.outbox) return false;
    return !this.snapshot.online || (await this.outbox.hasPending(visitId));
  }

  async queue(op: Op): Promise<StoredOp> {
    if (!this.outbox) throw new Error("no signed-in user");
    const stored = await this.outbox.enqueue(op);
    await this.refreshCounts();
    return stored;
  }

  async queueFile(
    file: Blob,
    meta: Parameters<Outbox["enqueueFile"]>[1],
    name: string,
    type: string,
  ): Promise<StoredOp> {
    if (!this.outbox) throw new Error("no signed-in user");
    const stored = await this.outbox.enqueueFile(file, meta, name, type);
    await this.refreshCounts();
    return stored;
  }

  list(): Promise<StoredOp[]> {
    return this.outbox ? this.outbox.list() : Promise.resolve([]);
  }

  async discard(seq: number): Promise<void> {
    await this.outbox?.discard(seq);
    await this.refreshCounts();
  }
  /** Drop a queued upload the person removed before it was sent. */
  async discardBlob(blobKey: string): Promise<void> {
    const op = (await this.list()).find((o) => o.kind === "evidence" && o.blobKey === blobKey);
    if (op) await this.discard(op.seq);
  }
  async discardFailed(): Promise<void> {
    await this.outbox?.discardFailed();
    await this.refreshCounts();
  }
  async discardAll(): Promise<void> {
    await this.outbox?.discardAll();
    await this.refreshCounts();
  }

  /** Send what is waiting. Only one flush runs at a time. */
  flush(): Promise<FlushResult | undefined> {
    if (!this.outbox || !this.executor) return Promise.resolve(undefined);
    if (this.flushing) return this.flushing;
    this.set({ syncing: true });
    const outbox = this.outbox;
    const executor = this.executor;
    this.flushing = outbox
      .flush(executor)
      .then(async (r) => {
        if (r.stalled) this.set({ online: false });
        await this.refreshCounts();
        if (r.done || r.failed) this.onFlushed?.(r);
        return r;
      })
      .catch(() => undefined)
      .finally(() => {
        this.flushing = null;
        this.set({ syncing: false });
      });
    return this.flushing;
  }

  /** Re-try soon after a stall without waiting for the next probe. */
  scheduleRetry(): void {
    setTimeout(() => void this.tick(), RETRY_MS).unref?.();
  }

  // ── read cache ────────────────────────────────────────────────────────
  async cacheRead<T>(name: string): Promise<T | undefined> {
    if (!this.userId) return undefined;
    try {
      return await this.db().kvGet<T>(`${this.userId}:${name}`);
    } catch {
      return undefined;
    }
  }

  async cacheWrite(name: string, value: unknown): Promise<void> {
    if (!this.userId) return;
    try {
      await this.db().kvSet(`${this.userId}:${name}`, value);
    } catch {
      // a full or blocked store must never break the app: the cache is a convenience
    }
  }

  /** Forget this device's cached copies of someone's data (sign-out). Queued changes are kept: they are that person's unsent work. */
  async clearCache(userId = this.userId): Promise<void> {
    if (!userId) return;
    try {
      await this.db().kvDeletePrefix(`${userId}:`);
    } catch {
      // nothing to clear
    }
  }

  // ── who is signed in, so the app can open with no connection ───────
  /** The identity from the last successful `/me`. Not scoped by user: it is how we learn whose cache to open. */
  async rememberSession(me: unknown): Promise<void> {
    try {
      await this.db().kvSet("session:me", me);
    } catch {
      // best effort
    }
  }

  async recallSession<T>(): Promise<T | undefined> {
    try {
      return await this.db().kvGet<T>("session:me");
    } catch {
      return undefined;
    }
  }

  async forgetSession(): Promise<void> {
    try {
      await this.db().kvDeletePrefix("session:");
    } catch {
      // nothing to forget
    }
  }

  /** Run `fn`; remember its result; if the network is down, hand back the last remembered result instead. */
  async withCache<T>(name: string, fn: () => Promise<T>): Promise<T> {
    try {
      const v = await fn();
      void this.cacheWrite(name, v);
      return v;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      this.reportNetworkFailure();
      const old = await this.cacheRead<T>(name);
      if (old !== undefined) return old;
      throw err;
    }
  }
}

export const offline = new OfflineSession();

export function useSyncState(): SyncState {
  return useSyncExternalStore(offline.subscribe, offline.getSnapshot, offline.getSnapshot);
}
