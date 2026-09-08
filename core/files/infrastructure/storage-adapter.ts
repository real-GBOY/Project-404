import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, unlink, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";

/**
 * A short-lived upload target the client `PUT`s the raw file bytes to directly,
 * bypassing the API process. For `r2` this is a presigned S3 URL on the bucket
 * endpoint; for `local` it is the API's own authenticated loopback route
 * (`PUT /api/files/:id/bytes`).
 */
export interface PresignedUpload {
  url: string;
  method: "PUT";
  /** Headers the client MUST echo on the PUT (empty for both current drivers). */
  headers: Record<string, string>;
  /** After this instant the URL/route no longer accepts the upload. */
  expiresAt: Date;
}

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
  /**
   * Issue a direct-to-storage upload target for `key`. Optional — a driver that
   * cannot presign omits it and callers fall back to a proxied upload.
   */
  presignPut?(
    key: string,
    opts: { contentType: string; contentLength?: number; expiresIn: number },
  ): Promise<PresignedUpload>;
  /**
   * Object existence + size/etag, without fetching the bytes. Used by the
   * confirm step to verify a direct upload actually landed. `null` when the
   * object does not exist. Optional — same rationale as `presignPut`.
   */
  head?(key: string): Promise<{ size: number; etag: string | null } | null>;
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

  /**
   * Local dev/test has no object store to presign against, so the "upload
   * target" is the API's own authenticated loopback route
   * (`PUT /api/files/:id/bytes`). The URL is returned **relative to the API
   * base** (no `/api` prefix — the global prefix lives in `main.ts`, and a
   * cross-origin client resolves it against its own `VITE_API_BASE`). The file
   * id is the last segment of the storage key (see `storageKeyFor`).
   */
  async presignPut(
    key: string,
    opts: { contentType: string; contentLength?: number; expiresIn: number },
  ): Promise<PresignedUpload> {
    const fileId = key.split("/").pop() ?? key;
    return {
      url: `/files/${encodeURIComponent(fileId)}/bytes`,
      method: "PUT",
      headers: {},
      expiresAt: new Date(Date.now() + opts.expiresIn * 1000),
    };
  }

  async head(key: string): Promise<{ size: number; etag: string | null } | null> {
    try {
      const s = await stat(this.pathFor(key));
      return { size: s.size, etag: null };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }
}

/**
 * `<org>/2026/08/file-id` — namespaced by tenant (§ docs/tenancy.md) so a
 * leaked or guessed key still cannot cross tenants, then by month to keep
 * directories bounded. Always forward-slash separated so the same key works
 * for local disk and S3.
 */
export function storageKeyFor(organizationId: string, fileId: string, now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${organizationId}/${y}/${m}/${fileId}`;
}
