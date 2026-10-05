import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";
import { getConfig } from "@core/kernel/config.js";
import { readRaqibConfig } from "@raqib/config.js";

/**
 * Field-level protection for the few values that must not sit in the database in the clear: national ID numbers
 * and second-factor secrets. Two keys are derived from one master key (`RAQIB_DATA_KEY`, 32 random bytes, base64):
 * an encryption key (AES-256-GCM, random nonce per value) and a separate HMAC key for the "blind index" that lets
 * us look a value up (or enforce uniqueness) without being able to read it back.
 *
 * Without `RAQIB_DATA_KEY` outside production the keys are derived from the JWT secret so dev and tests work;
 * production refuses to start without it (see `assertDataKeyConfigured`). Losing the key loses these values, so it
 * belongs in the same secret store as the database password and in the backup runbook.
 */

const SEALED = /^v1:([A-Za-z0-9_-]+):([A-Za-z0-9_-]+):([A-Za-z0-9_-]+)$/;
let cached: { master: string; enc: Buffer; mac: Buffer } | undefined;

function keys(): { enc: Buffer; mac: Buffer } {
  const raw = readRaqibConfig().dataKey || getConfig().jwtSecret;
  if (cached?.master === raw) return cached;
  const master = readRaqibConfig().dataKey ? Buffer.from(raw, "base64") : Buffer.from(raw, "utf8");
  const derive = (info: string) => Buffer.from(hkdfSync("sha256", master, "raqib-data-key", info, 32));
  cached = { master: raw, enc: derive("enc-v1"), mac: derive("mac-v1") };
  return cached;
}

/** Fail fast at boot in production when no dedicated key is set. */
export function assertDataKeyConfigured(): void {
  const cfg = readRaqibConfig();
  if (getConfig().nodeEnv === "production" && !cfg.dataKey) {
    throw new Error("RAQIB_DATA_KEY is required in production (32 random bytes, base64 — e.g. `openssl rand -base64 32`).");
  }
}

export function isSealed(v: string): boolean {
  return SEALED.test(v);
}

/** Encrypt a value. Output is self-describing (`v1:nonce:ciphertext:tag`) so plaintext legacy values are detectable. */
export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", keys().enc, iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1:${iv.toString("base64url")}:${ct.toString("base64url")}:${c.getAuthTag().toString("base64url")}`;
}

/** Decrypt a sealed value; a value that was never sealed (legacy rows) is returned as is. Tampering throws. */
export function open(stored: string): string {
  const m = SEALED.exec(stored);
  if (!m) return stored;
  const d = createDecipheriv("aes-256-gcm", keys().enc, Buffer.from(m[1]!, "base64url"));
  d.setAuthTag(Buffer.from(m[3]!, "base64url"));
  return Buffer.concat([d.update(Buffer.from(m[2]!, "base64url")), d.final()]).toString("utf8");
}

/** Deterministic, keyed digest of a normalized value — equality lookups without storing the value readable. */
export function blindIndex(value: string, scope = ""): string {
  return createHmac("sha256", keys().mac).update(`${scope}\u0000${value.trim().toLowerCase()}`).digest("base64url");
}
