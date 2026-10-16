export type PromoKind = "percent" | "fixed";

export interface PromoRule {
  kind: PromoKind;
  /** percent: 1-99. fixed: minor units (piastres). */
  value: number;
  enabled: boolean;
  maxUses: number | null;
  validFrom: Date | null;
  validUntil: Date | null;
}

/** Why a code cannot be used right now, in words a guest can act on. `null` means it can. */
export function unusableReason(rule: PromoRule, usedCount: number, now: Date): string | null {
  if (!rule.enabled) return "That code is no longer active.";
  if (rule.validFrom && now < rule.validFrom) return "That code is not valid yet.";
  if (rule.validUntil && now > rule.validUntil) return "That code has expired.";
  if (rule.maxUses !== null && usedCount >= rule.maxUses) return "That code has been fully used.";
  return null;
}

/** The discount in minor units: whole piastres, rounded down, never more than the subtotal. */
export function discountFor(rule: Pick<PromoRule, "kind" | "value">, subtotalMinor: number): number {
  const raw = rule.kind === "percent" ? Math.floor((subtotalMinor * rule.value) / 100) : rule.value;
  return Math.min(Math.max(raw, 0), subtotalMinor);
}

/** A free order has no payment to verify, which the manual-proof flow cannot handle: a code must leave something to pay. */
export const leavesSomethingToPay = (subtotalMinor: number, discountMinor: number): boolean => subtotalMinor - discountMinor > 0;

export const normalizeCode = (raw: string): string => raw.trim().toUpperCase().replace(/\s+/g, "");
