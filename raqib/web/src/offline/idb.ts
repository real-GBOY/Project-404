/**
 * A very small promise wrapper over IndexedDB — three stores and nothing clever:
 *   kv      cached read-model snapshots (an inspection as last seen, lists), keyed by "<user>:<name>"
 *   outbox  the changes made offline, in the order they were made (auto-increment `seq`)
 *   blobs   files queued for upload (photos, videos), keyed by "<user>:<id>"
 * Everything here is device-local and scoped by user id by the callers; `clearScope` removes one person's cache.
 */
const DB_NAME = "raqib-offline";
const VERSION = 1;
/** Files up to this size are stored as bytes; larger ones as a Blob. */
const INLINE_LIMIT = 32 * 1_048_576;

export interface Idb {
  kvGet<T>(key: string): Promise<T | undefined>;
  kvSet(key: string, value: unknown): Promise<void>;
  kvDeletePrefix(prefix: string): Promise<void>;
  outboxAll<T>(): Promise<T[]>;
  outboxAdd<T extends object>(item: T): Promise<number>;
  outboxPut<T extends { seq: number }>(item: T): Promise<void>;
  outboxDelete(seq: number): Promise<void>;
  blobPut(key: string, blob: Blob): Promise<void>;
  blobGet(key: string): Promise<Blob | undefined>;
  blobDelete(key: string): Promise<void>;
}

/** Read a Blob/File into memory (FileReader works in every browser and test environment, unlike Blob.arrayBuffer on older engines). */
const bytesOf = (blob: Blob): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(blob);
  });

const wrap = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const done = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

function open(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore("kv");
      db.createObjectStore("outbox", { keyPath: "seq", autoIncrement: true });
      db.createObjectStore("blobs");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function createIdb(dbName: string = DB_NAME): Idb {
  let db: Promise<IDBDatabase> | undefined;
  const store = async (name: "kv" | "outbox" | "blobs", mode: IDBTransactionMode) => {
    db ??= open(dbName);
    const tx = (await db).transaction(name, mode);
    return { s: tx.objectStore(name), tx };
  };
  return {
    async kvGet<T>(key: string) {
      const { s } = await store("kv", "readonly");
      return (await wrap(s.get(key))) as T | undefined;
    },
    async kvSet(key, value) {
      const { s, tx } = await store("kv", "readwrite");
      s.put(value, key);
      await done(tx);
    },
    async kvDeletePrefix(prefix) {
      const { s, tx } = await store("kv", "readwrite");
      const keys = (await wrap(s.getAllKeys())) as string[];
      for (const k of keys) if (typeof k === "string" && k.startsWith(prefix)) s.delete(k);
      await done(tx);
    },
    async outboxAll<T>() {
      const { s } = await store("outbox", "readonly");
      return (await wrap(s.getAll())) as T[];
    },
    async outboxAdd(item) {
      const { s, tx } = await store("outbox", "readwrite");
      const key = await wrap(s.add(item));
      await done(tx);
      return key as number;
    },
    async outboxPut(item) {
      const { s, tx } = await store("outbox", "readwrite");
      s.put(item);
      await done(tx);
    },
    async outboxDelete(seq) {
      const { s, tx } = await store("outbox", "readwrite");
      s.delete(seq);
      await done(tx);
    },
    async blobPut(key, blob) {
      // Photos and documents are stored as plain bytes (the most portable form across browsers, including iOS Safari);
      // a large video stays a Blob so the browser can keep it on disk rather than in memory.
      const value =
        blob.size <= INLINE_LIMIT ? { type: blob.type, bytes: await bytesOf(blob) } : blob;
      const { s, tx } = await store("blobs", "readwrite");
      s.put(value, key);
      await done(tx);
    },
    async blobGet(key) {
      const { s } = await store("blobs", "readonly");
      const v = (await wrap(s.get(key))) as Blob | { type: string; bytes: ArrayBuffer } | undefined;
      if (!v) return undefined;
      return v instanceof Blob ? v : new Blob([v.bytes], { type: v.type });
    },
    async blobDelete(key) {
      const { s, tx } = await store("blobs", "readwrite");
      s.delete(key);
      await done(tx);
    },
  };
}
