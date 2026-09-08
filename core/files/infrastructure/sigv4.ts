import { createHash, createHmac } from "node:crypto";

/**
 * AWS Signature Version 4 — the query-string ("presigned URL") and
 * Authorization-header signing schemes, implemented from the spec with only
 * `node:crypto`. No AWS SDK, no third-party signer.
 *
 *   canonical request → SHA-256
 *     → string to sign  (AWS4-HMAC-SHA256)
 *       → AWS4 signing key (HMAC chain over date/region/service)
 *         → HMAC-SHA256 signature
 *
 * Cloudflare R2 speaks the S3 dialect of SigV4: `service = "s3"`,
 * `region = "auto"`, path-style addressing (`/<bucket>/<key>`).
 *
 * Reference test vector (AWS "Signature Version 4 Test Suite" / S3 GET example)
 * is exercised in `core/files/tests/sigv4.test.ts`.
 */

const ALGORITHM = "AWS4-HMAC-SHA256";
const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";
/** SHA-256 of the empty string — the payload hash for bodyless GET/HEAD/DELETE. */
export const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

export function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

/** `20130524T000000Z` (amzDate) and `20130524` (dateStamp) for a given instant. */
export function amzDate(date: Date): { amzDate: string; dateStamp: string } {
  const amz = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate: amz, dateStamp: amz.slice(0, 8) };
}

/**
 * RFC 3986 percent-encoding over the UTF-8 bytes. `encodeSlash: false` keeps
 * `/` literal, as S3 requires for the canonical URI path.
 */
export function uriEncode(input: string, encodeSlash = true): string {
  let out = "";
  for (const byte of Buffer.from(input, "utf8")) {
    const ch = String.fromCharCode(byte);
    if (/[A-Za-z0-9\-._~]/.test(ch)) out += ch;
    else if (ch === "/" && !encodeSlash) out += ch;
    else out += `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  return out;
}

/** AWS4 signing key: HMAC chain kSecret → kDate → kRegion → kService → kSigning. */
function signingKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Buffer {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

function canonicalQueryString(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((k) => `${uriEncode(k)}=${uriEncode(params[k])}`)
    .join("&");
}

export interface PresignOptions {
  method: string;
  /** Origin host, e.g. `account.r2.cloudflarestorage.com`. */
  host: string;
  /** Canonical URI path, e.g. `/bucket/org/2026/09/file_x`. Encoded here. */
  path: string;
  service: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  expiresIn: number;
  /** Signing instant — injected in tests for determinism. Defaults to now. */
  now?: Date;
  /** Extra query params to fold into the signature (e.g. response overrides). */
  query?: Record<string, string>;
}

/**
 * A presigned URL: auth travels entirely in `X-Amz-*` query parameters, so the
 * client `PUT`s/`GET`s it with no Authorization header. Only `host` is signed —
 * the client may send any other headers (integrity is enforced downstream by
 * the confirm-step HEAD, not by signed content headers).
 */
export function presignUrl(opts: PresignOptions): string {
  const { amzDate: amzNow, dateStamp } = amzDate(opts.now ?? new Date());
  const scope = `${dateStamp}/${opts.region}/${opts.service}/aws4_request`;
  const canonicalUri = uriEncode(opts.path, false);

  const query: Record<string, string> = {
    ...opts.query,
    "X-Amz-Algorithm": ALGORITHM,
    "X-Amz-Credential": `${opts.accessKeyId}/${scope}`,
    "X-Amz-Date": amzNow,
    "X-Amz-Expires": String(opts.expiresIn),
    "X-Amz-SignedHeaders": "host",
  };

  const canonicalRequest = [
    opts.method.toUpperCase(),
    canonicalUri,
    canonicalQueryString(query),
    `host:${opts.host}\n`,
    "host",
    UNSIGNED_PAYLOAD,
  ].join("\n");

  const stringToSign = [ALGORITHM, amzNow, scope, sha256Hex(canonicalRequest)].join("\n");
  const signature = hmac(
    signingKey(opts.secretAccessKey, dateStamp, opts.region, opts.service),
    stringToSign,
  ).toString("hex");

  return `https://${opts.host}${canonicalUri}?${canonicalQueryString(query)}&X-Amz-Signature=${signature}`;
}

export interface SignRequestOptions {
  method: string;
  host: string;
  path: string;
  service: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Hex SHA-256 of the request body. Defaults to the empty-string hash. */
  payloadHash?: string;
  now?: Date;
}

/**
 * A signed request: the signature travels in the `Authorization` header along
 * with `x-amz-date` and `x-amz-content-sha256`. Used for the server-side
 * PUT/GET/HEAD/DELETE the API itself makes against R2.
 */
export function signRequest(opts: SignRequestOptions): {
  url: string;
  headers: Record<string, string>;
} {
  const { amzDate: amzNow, dateStamp } = amzDate(opts.now ?? new Date());
  const scope = `${dateStamp}/${opts.region}/${opts.service}/aws4_request`;
  const payloadHash = opts.payloadHash ?? EMPTY_SHA256;
  const canonicalUri = uriEncode(opts.path, false);

  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalHeaders =
    `host:${opts.host}\n` + `x-amz-content-sha256:${payloadHash}\n` + `x-amz-date:${amzNow}\n`;

  const canonicalRequest = [
    opts.method.toUpperCase(),
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const stringToSign = [ALGORITHM, amzNow, scope, sha256Hex(canonicalRequest)].join("\n");
  const signature = hmac(
    signingKey(opts.secretAccessKey, dateStamp, opts.region, opts.service),
    stringToSign,
  ).toString("hex");

  const authorization =
    `${ALGORITHM} Credential=${opts.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    url: `https://${opts.host}${canonicalUri}`,
    headers: {
      authorization,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzNow,
    },
  };
}
