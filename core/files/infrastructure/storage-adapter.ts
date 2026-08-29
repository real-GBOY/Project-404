import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";

/**
 * The physical bytes store. The Employee/domain modules never see this — they
 * use IFileStorage (§4). Local disk is the v0.1 driver; an S3-compatible
 * adapter (§3.1) implements the same interface later with no use-case change.
 */
export interface StorageAdapter {
  readonly driver: string;
  put(key: string, content: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
  /** A URL the client can fetch. Local driver returns an API path. */
  url(key: string): Promise<string>;
}

export function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export class LocalDiskAdapter implements StorageAdapter {
  readonly driver = "local";
  private readonly root: string;

  constructor(rootPath: string) {
    this.root = resolve(rootPath);
  }

  private pathFor(key: string): string {
    // Storage keys are always forward-slash separated (see storageKeyFor); map
    // to the OS separator only here, at the filesystem boundary.
    const full = resolve(this.root, ...key.split("/"));
    if (!full.startsWith(this.root)) throw new Error("storage key escapes the storage root");
    return full;
  }

  async put(key: string, content: Buffer): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }

  get(key: string): Promise<Buffer> {
    return readFile(this.pathFor(key));
  }

  async remove(key: string): Promise<void> {
    await unlink(this.pathFor(key)).catch((err: NodeJS.ErrnoException) => {
      if (err.code !== "ENOENT") throw err;
    });
  }

  async url(key: string): Promise<string> {
    return `/api/files/content/${encodeURIComponent(key)}`;
  }
}

/**
 * `2026/08/file-id` — keeps directories from growing unbounded. Always
 * forward-slash separated so the same key works for local disk and S3.
 */
export function storageKeyFor(fileId: string, now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}/${m}/${fileId}`;
}
