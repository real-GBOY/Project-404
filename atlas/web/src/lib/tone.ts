/**
 * The canonical status→color system (design's `tone()` lookup, PLAN spec §1).
 * Every status pill in the app resolves a raw status string to one of six
 * semantic tones; components never carry their own color logic.
 */
export type Tone = "success" | "brand" | "warning" | "danger" | "info" | "neutral" | "muted";

export const TONE_CLASS: Record<Tone, string> = {
  success: "bg-success-surface text-success",
  brand: "bg-primary-surface text-primary",
  warning: "bg-warning-surface text-warning",
  danger: "bg-danger-surface text-danger",
  info: "bg-info-surface text-info",
  neutral: "bg-neutral-tone-surface text-neutral-tone",
  muted: "bg-surface-track text-muted",
};

/** Raw status string (as it appears in mock data / API payloads) → semantic tone. */
const STATUS_TONE: Record<string, Tone> = {
  Available: "success",
  Sold: "brand",
  Reserved: "warning",
  "On Hold": "neutral",
  Unavailable: "muted",
  Paid: "success",
  Pending: "warning",
  Overdue: "danger",
  Partial: "info",
  New: "info",
  Qualified: "brand",
  Contacted: "neutral",
  Viewing: "warning",
  Negotiation: "warning",
  Contracted: "success",
  Lost: "danger",
  Active: "success",
  Draft: "muted",
  Signed: "success",
  "Awaiting Approval": "warning",
  Expiring: "danger",
  Approved: "success",
  Rejected: "danger",
  Done: "success",
  "In Progress": "info",
  Open: "info",
  High: "danger",
  Medium: "warning",
  Low: "muted",
  Launched: "success",
  "Under Construction": "info",
  Delivered: "brand",
  "Pre-launch": "neutral",
  Verified: "success",
  Expired: "danger",
  Escalated: "danger",
};

/** Resolve any known status string to its tone; unknown statuses fall back to `muted`. */
export function toneOf(status: string): Tone {
  return STATUS_TONE[status] ?? "muted";
}
