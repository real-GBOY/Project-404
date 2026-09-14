// Extracted verbatim from the design prototype's `TONES` class field.
// Maps a status string to a [backgroundColor, foregroundColor] pair used for status badges/pills.
// Fallback used by the prototype when a status is not in this map: ['#F2F2EE', '#6E6E6A'].

export type ToneTuple = [background: string, foreground: string];

export const TONE_FALLBACK: ToneTuple = ['#F2F2EE', '#6E6E6A'];

export const TONES: Record<string, ToneTuple> = {
  Available: ['#E8F4EF', '#1E7A5A'],
  Sold: ['#EDF1FC', '#1B4DB8'],
  Reserved: ['#FCF3E4', '#8A6120'],
  'On Hold': ['#F1EFEC', '#6E6459'],
  Unavailable: ['#F2F2EE', '#8A8A85'],
  Paid: ['#E8F4EF', '#1E7A5A'],
  Pending: ['#FCF3E4', '#8A6120'],
  Overdue: ['#FBEDED', '#9A3838'],
  Partial: ['#F4F6FC', '#3A5FA8'],
  New: ['#F4F6FC', '#3A5FA8'],
  Qualified: ['#EDF1FC', '#1B4DB8'],
  Contacted: ['#F1EFEC', '#6E6459'],
  Viewing: ['#FCF3E4', '#8A6120'],
  Negotiation: ['#FCF3E4', '#8A6120'],
  Contracted: ['#E8F4EF', '#1E7A5A'],
  Lost: ['#FBEDED', '#9A3838'],
  Active: ['#E8F4EF', '#1E7A5A'],
  Draft: ['#F2F2EE', '#8A8A85'],
  Signed: ['#E8F4EF', '#1E7A5A'],
  'Awaiting Approval': ['#FCF3E4', '#8A6120'],
  Expiring: ['#FBEDED', '#9A3838'],
  Approved: ['#E8F4EF', '#1E7A5A'],
  Rejected: ['#FBEDED', '#9A3838'],
  Done: ['#E8F4EF', '#1E7A5A'],
  'In Progress': ['#F4F6FC', '#3A5FA8'],
  Open: ['#F4F6FC', '#3A5FA8'],
  High: ['#FBEDED', '#9A3838'],
  Medium: ['#FCF3E4', '#8A6120'],
  Low: ['#F2F2EE', '#8A8A85'],
  Launched: ['#E8F4EF', '#1E7A5A'],
  'Under Construction': ['#F4F6FC', '#3A5FA8'],
  Delivered: ['#EDF1FC', '#1B4DB8'],
  'Pre-launch': ['#F1EFEC', '#6E6459'],
  Verified: ['#E8F4EF', '#1E7A5A'],
  Expired: ['#FBEDED', '#9A3838'],
  Escalated: ['#FBEDED', '#9A3838'],
};

// tone(v) helper from the prototype: TONES[v] ?? TONE_FALLBACK, returned as { bg, fg }.
export function tone(status: string): { bg: string; fg: string } {
  const t = TONES[status] || TONE_FALLBACK;
  return { bg: t[0], fg: t[1] };
}
