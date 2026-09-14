// Extracted verbatim from the design prototype's `TONES` class field.
// Maps a status string to a [backgroundColor, foregroundColor] pair used for status badges/pills.
// Fallback used by the prototype when a status is not in this map: [surfaceTrack, secondary].
//
// Every pair below is one of the 7 (surface, tone-fg) combinations named once in
// `src/styles/colors.ts` (`TONE_PAIRS`), referenced here instead of repeating hex literals.

import { TOKEN_COLORS, TONE_PAIRS } from "@/styles/colors";

export type ToneTuple = [background: string, foreground: string];

const SUCCESS: ToneTuple = [...TONE_PAIRS.success];
const BRAND: ToneTuple = [...TONE_PAIRS.brand];
const WARNING: ToneTuple = [...TONE_PAIRS.warning];
const NEUTRAL: ToneTuple = [...TONE_PAIRS.neutral];
const MUTED: ToneTuple = [...TONE_PAIRS.muted];
const DANGER: ToneTuple = [...TONE_PAIRS.danger];
const INFO: ToneTuple = [...TONE_PAIRS.info];

export const TONE_FALLBACK: ToneTuple = [TOKEN_COLORS.surface.surfaceTrack, TOKEN_COLORS.text.secondary];

export const TONES: Record<string, ToneTuple> = {
  Available: SUCCESS,
  Sold: BRAND,
  Reserved: WARNING,
  'On Hold': NEUTRAL,
  Unavailable: MUTED,
  Paid: SUCCESS,
  Pending: WARNING,
  Overdue: DANGER,
  Partial: INFO,
  New: INFO,
  Qualified: BRAND,
  Contacted: NEUTRAL,
  Viewing: WARNING,
  Negotiation: WARNING,
  Contracted: SUCCESS,
  Lost: DANGER,
  Active: SUCCESS,
  Draft: MUTED,
  Signed: SUCCESS,
  'Awaiting Approval': WARNING,
  Expiring: DANGER,
  Approved: SUCCESS,
  Rejected: DANGER,
  Done: SUCCESS,
  'In Progress': INFO,
  Open: INFO,
  High: DANGER,
  Medium: WARNING,
  Low: MUTED,
  Launched: SUCCESS,
  'Under Construction': INFO,
  Delivered: BRAND,
  'Pre-launch': NEUTRAL,
  Verified: SUCCESS,
  Expired: DANGER,
  Escalated: DANGER,
};

// tone(v) helper from the prototype: TONES[v] ?? TONE_FALLBACK, returned as { bg, fg }.
export function tone(status: string): { bg: string; fg: string } {
  const t = TONES[status] || TONE_FALLBACK;
  return { bg: t[0], fg: t[1] };
}
