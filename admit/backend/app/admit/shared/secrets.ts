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

/** No O and no I, so 0 and 1 are always digits - read aloud and typed from a screenshot without mistakes. */
const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";

function block(n: number): string {
  let out = "";
  for (let i = 0; i < n; i++) out += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return out;
}

/** ADM-7K4Q-2931 style: shown to customers, typed into transfer notes, quoted to the organizer. */
export function newBookingRef(): string {
  return `ADM-${block(4)}-${block(4)}`;
}

/** TKT-8F3D-K29Q style: printed under the QR code so door staff can type it. Not the QR token (that is derived from it, see ticketToken). */
export function newTicketId(): string {
  return `TKT-${block(4)}-${block(4)}`;
}

export const TICKET_ID_SHAPE = /^TKT-[A-HJ-NP-Z0-9]{4}-[A-HJ-NP-Z0-9]{4}$/;

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

/**
 * What a ticket's QR actually encodes: a link to the customer site (`/q/<token>`). Any phone camera or QR app that scans it lands on a
 * harmless page; the door scanner reads the token out of the link. The token is the last path segment and nothing else is in the link.
 */
export function qrPayload(token: string): string {
  const base = (readAdmitConfig().publicUrl || getConfig().appUrl).replace(/\/$/, "");
  return `${base}/q/${token}`;
}
