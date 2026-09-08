import type { PresignedUpload, StorageAdapter } from "./storage-adapter.js";
import { EMPTY_SHA256, presignUrl, sha256Hex, signRequest } from "./sigv4.js";

export interface R2AdapterConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Override the S3 API endpoint. Defaults to the account's R2 endpoint. */
  endpoint?: string;
  /** Public base URL (custom domain / r2.dev) for `visibility: "public"` files. */
  publicBaseUrl?: string;
  /** TTL for presigned GET (download) URLs, seconds. Defaults to 900. */
  presignTtlSeconds?: number;
}

/**
 * Cloudflare R2 storage driver, spoken over R2's S3-compatible API and signed
 * with the hand-rolled SigV4 in `./sigv4.ts` (no AWS SDK). Path-style
 * addressing against `https://<account>.r2.cloudflarestorage.com/<bucket>/<key>`;
 * R2 fixes the region to `auto`.
 */
export class R2Adapter implements StorageAdapter {
  readonly driver = "r2";

  private readonly host: string;
  private readonly bucket: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly publicBaseUrl?: string;
  private readonly downloadTtl: number;
  private readonly region = "auto";
  private readonly service = "s3";

  constructor(config: R2AdapterConfig) {
    const endpoint = config.endpoint ?? `https://${config.accountId}.r2.cloudflarestorage.com`;
    this.host = new URL(endpoint).host;
    this.bucket = config.bucket;
    this.accessKeyId = config.accessKeyId;
    this.secretAccessKey = config.secretAccessKey;
    this.publicBaseUrl = config.publicBaseUrl?.replace(/\/$/, "");
    this.downloadTtl = config.presignTtlSeconds ?? 900;
  }

  /** `/bucket/key` — the canonical URI path S3 signs over. */
  private path(key: string): string {
    return `/${this.bucket}/${key.replace(/^\/+/, "")}`;
  }

  private sign(method: string, key: string, payloadHash: string) {
    return signRequest({
      method,
      host: this.host,
      path: this.path(key),
      service: this.service,
      region: this.region,
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      payloadHash,
    });
  }

  async put(key: string, content: Buffer): Promise<void> {
    const { url, headers } = this.sign("PUT", key, sha256Hex(content));
    const res = await fetch(url, { method: "PUT", headers, body: content });
    if (!res.ok) throw await r2Error("PUT", key, res);
  }

  async get(key: string): Promise<Buffer> {
    const { url, headers } = this.sign("GET", key, EMPTY_SHA256);
    const res = await fetch(url, { method: "GET", headers });
    if (!res.ok) throw await r2Error("GET", key, res);
    return Buffer.from(await res.arrayBuffer());
  }

  async remove(key: string): Promise<void> {
    const { url, headers } = this.sign("DELETE", key, EMPTY_SHA256);
    const res = await fetch(url, { method: "DELETE", headers });
    // S3/R2 DELETE is idempotent — 204 on success, 404 is fine too.
    if (!res.ok && res.status !== 404) throw await r2Error("DELETE", key, res);
  }

  async head(key: string): Promise<{ size: number; etag: string | null } | null> {
    const { url, headers } = this.sign("HEAD", key, EMPTY_SHA256);
    const res = await fetch(url, { method: "HEAD", headers });
    if (res.status === 404) return null;
    if (!res.ok) throw await r2Error("HEAD", key, res);
    const len = res.headers.get("content-length");
    const etag = res.headers.get("etag");
    return {
      size: len ? Number(len) : 0,
      etag: etag ? etag.replace(/"/g, "") : null,
    };
  }

  async presignPut(
    key: string,
    opts: { contentType: string; contentLength?: number; expiresIn: number },
  ): Promise<PresignedUpload> {
    const url = presignUrl({
      method: "PUT",
      host: this.host,
      path: this.path(key),
      service: this.service,
      region: this.region,
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      expiresIn: opts.expiresIn,
    });
    return {
      url,
      method: "PUT",
      headers: {},
      expiresAt: new Date(Date.now() + opts.expiresIn * 1000),
    };
  }

  async url(key: string): Promise<string> {
    if (this.publicBaseUrl) return `${this.publicBaseUrl}/${key.replace(/^\/+/, "")}`;
    return presignUrl({
      method: "GET",
      host: this.host,
      path: this.path(key),
      service: this.service,
      region: this.region,
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      expiresIn: this.downloadTtl,
    });
  }
}

async function r2Error(op: string, key: string, res: Response): Promise<Error> {
  const body = await res.text().catch(() => "");
  return new Error(
    `R2 ${op} ${key} failed: ${res.status} ${res.statusText}${body ? ` — ${body}` : ""}`,
  );
}
