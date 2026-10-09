import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { getConfig } from "@core/kernel/config.js";
import { readAdmitConfig } from "@admit/config.js";

/**
 * Every secret-bearing value in Admit is made here, so the rules live in one place:
 *
 *  - booking `ref`        public, human-friendly, NOT a credential (a ref alone grants nothing);
 *  - access secret        the magic-link credential of a guest booking: HMAC(ticketKey, bookingId); only its
 *                         SHA-256 is stored, and it is re-derived when a later email needs the link;
 *  - ticket QR token      128 bits derived as HMAC(ticketKey, ticketId); only its SHA-256 is stored, so a
 *                         database dump cannot be turned into working tickets, and the QR can still be
 *                         re-rendered on demand without keeping the token anywhere.
 */

/** No 0/O/1/I/L - read aloud and typed from a screenshot without mistakes. */
const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function newBookingRef(): string {
  let out = "";
  for (let i = 0; i < 8; i++) out += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return `ADM-${out}`;
}

export const sha256Hex = (value: string): string => createHash("sha256").update(value).digest("hex");

/** The magic-link credential of a guest booking: 192 bits derived as HMAC(ticketKey, bookingId). Re-derivable for later emails; only its hash is stored. */
export function accessSecret(bookingId: string): string {
  return createHmac("sha256", ticketKey()).update(`access:${bookingId}`).digest().subarray(0, 24).toString("base64url");
}

export const accessSecretHash = (bookingId: string): string => sha256Hex(accessSecret(bookingId));

export function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

/** The ticket key: configured (required in production), else a development key derived from the JWT secret. */
function ticketKey(): Buffer {
  const configured = readAdmitConfig().ticketKey;
  if (configured) return Buffer.from(configured, "base64");
  const cfg = getConfig();
  if (cfg.nodeEnv === "production") throw new Error("ADMIT_TICKET_KEY is required in production (32 random bytes, base64).");
  return createHmac("sha256", "admit-dev-ticket-key").update(cfg.jwtSecret).digest();
}

/** Fails at boot, not at the first approved payment, when production has no ticket key. */
export function assertTicketKeyConfigured(): void {
  ticketKey();
}

/** The 128-bit QR token of a ticket (22 base64url characters). Never logged, never returned to staff UIs. */
export function ticketToken(ticketId: string): string {
  return createHmac("sha256", ticketKey()).update(`ticket:${ticketId}`).digest().subarray(0, 16).toString("base64url");
}

export const ticketTokenHash = (ticketId: string): string => sha256Hex(ticketToken(ticketId));

/** A scanned QR payload is `<token>` only; anything else is rejected before touching the database. */
export const TOKEN_SHAPE = /^[A-Za-z0-9_-]{22}$/;
