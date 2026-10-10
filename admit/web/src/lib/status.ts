import type { BookingStatus, EmailStatus, EventStatus, ScanResult, SubmissionStatus, TicketStatus } from "@/api/types";

/**
 * The status system: one meaning per color, product-wide. Every status is glyph + word + color, never color alone.
 * Tones map to the tokens in styles/index.css (`pending`, `ok`, `bad`, `used`, `todo`, `off`, `info`).
 */
export type Tone = "pending" | "ok" | "bad" | "used" | "todo" | "off" | "info";

export interface StatusView {
  tone: Tone;
  glyph: string;
  label: string;
}

export const GLYPH: Record<Tone, string> = { pending: "◷", ok: "✓", bad: "✕", used: "!", todo: "→", off: "—", info: "i" };

const v = (tone: Tone, label: string): StatusView => ({ tone, glyph: GLYPH[tone], label });

export const BOOKING: Record<BookingStatus, StatusView> = {
  AWAITING_PAYMENT: v("todo", "Awaiting payment"),
  IN_REVIEW: v("pending", "In review"),
  CONFIRMED: v("ok", "Verified"),
  REJECTED: v("bad", "Rejected"),
  EXPIRED: v("off", "Expired"),
  CANCELLED: v("off", "Cancelled"),
};

export const SUBMISSION: Record<SubmissionStatus, StatusView> = {
  SUBMITTED: v("pending", "In review"),
  APPROVED: v("ok", "Approved"),
  REJECTED: v("bad", "Rejected"),
  SUPERSEDED: v("off", "Replaced"),
};

export const TICKET: Record<TicketStatus, StatusView> = {
  VALID: v("ok", "Valid"),
  USED: v("used", "Checked in"),
  REVOKED: v("bad", "Revoked"),
};

export const EMAIL: Record<EmailStatus, StatusView> = {
  QUEUED: v("pending", "Queued"),
  ACCEPTED: v("info", "Accepted"),
  DELIVERED: v("ok", "Delivered"),
  RETRYING: v("pending", "Retrying"),
  FAILED: v("bad", "Failed"),
};

export const EVENT: Record<EventStatus, StatusView> = {
  draft: v("off", "Draft"),
  published: v("ok", "Published"),
  cancelled: v("bad", "Cancelled"),
  archived: v("off", "Archived"),
};

export const SCAN: Record<ScanResult, StatusView> = {
  ADMITTED: v("ok", "Admitted"),
  ALREADY_USED: v("used", "Already used"),
  INVALID: v("bad", "Invalid"),
};

export const EMAIL_TYPE_LABEL: Record<string, string> = {
  INSTRUCTIONS: "Payment instructions",
  PROOF_RECEIVED: "Proof received",
  TICKETS: "Ticket confirmation",
  REJECTED: "Payment rejected",
  EXPIRED: "Booking expired",
  CANCELLED: "Booking cancelled",
  MAGIC_LINK: "Booking link",
};
