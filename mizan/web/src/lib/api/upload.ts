import { bearerHeaders, withApiBase } from "./http-client";
import { ApiError } from "./api-error";

/** The presigned upload target the API hands back from a `.../uploads` call. */
export interface PresignedUpload {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresAt: string;
}

/**
 * PUT the raw file bytes to a presigned upload target.
 *
 * - Absolute `upload.url` (an R2 presigned URL) → plain `fetch`, **no** bearer
 *   token: the signature is in the query string and R2 rejects an unexpected
 *   `Authorization` header.
 * - Relative `upload.url` (the local driver's `/api/files/:id/bytes` loopback)
 *   → prefixed with the API base and sent with the normal bearer token.
 */
export async function putToPresignedUrl(upload: PresignedUpload, blob: Blob): Promise<void> {
  const isAbsolute = /^https?:\/\//i.test(upload.url);
  const headers: Record<string, string> = { ...upload.headers };
  if (!isAbsolute) {
    Object.assign(headers, bearerHeaders());
    // The local loopback route parses `application/octet-stream` as a raw
    // buffer; a `Blob` body would otherwise carry its own MIME type.
    headers["Content-Type"] = "application/octet-stream";
  }

  const res = await fetch(withApiBase(upload.url), {
    method: upload.method,
    headers,
    body: blob,
  });
  if (!res.ok) {
    throw new ApiError(res.status, { code: "upload.failed", message: "The file upload failed." });
  }
}
