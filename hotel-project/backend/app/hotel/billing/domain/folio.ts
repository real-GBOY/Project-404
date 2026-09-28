import { fromPiastres, toPiastres } from "@hotel/hotel/shared/money.js";

/**
 * The folio is a ledger. Everything here is a pure function of posted charges and payments —
 * nothing is stored as "paid". Money is summed in integer piastres.
 *
 *   total   = Σ active charges + Σ their VAT          (after check-in)
 *           = booked room total + VAT at today's rate (before check-in: what the stay will cost)
 *           = 0                                       (cancelled before check-in: nothing owed)
 *   paid    = Σ completed payments − Σ refunds
 *   balance = total − paid
 */
export type PaymentStatus = "pending" | "partial" | "paid" | "refunded";

export interface ChargeLine {
  amount: number;
  taxAmount: number;
  voided: boolean;
}

export interface FolioTotals {
  charges: number;
  tax: number;
  total: number;
  paid: number;
  refunded: number;
  balance: number;
  paymentStatus: PaymentStatus;
  /** True once room charges are posted (check-in); before that `total` is the expected cost. */
  posted: boolean;
}

/** VAT for one charge line, in whole piastres. */
export function taxFor(amount: number, taxRate: number): number {
  return fromPiastres(Math.round(toPiastres(amount) * taxRate));
}

/**
 * Split a booked stay into per-night room charges that carry the booking's discount and sum
 * EXACTLY to the booked total (the last night absorbs rounding).
 */
export function splitRoomCharges(
  nightlyRates: Array<{ date: string; rate: number }>,
  roomTotal: number,
  total: number,
): Array<{ date: string; amount: number }> {
  const totalP = toPiastres(total);
  const roomTotalP = toPiastres(roomTotal);
  let allocated = 0;
  return nightlyRates.map((n, i) => {
    const isLast = i === nightlyRates.length - 1;
    const share =
      isLast || roomTotalP === 0
        ? totalP - allocated
        : Math.round((toPiastres(n.rate) * totalP) / roomTotalP);
    allocated += share;
    return { date: n.date, amount: fromPiastres(share) };
  });
}

export function paymentStatusFor(total: number, paid: number, refunded: number): PaymentStatus {
  const totalP = toPiastres(total);
  const paidP = toPiastres(paid);
  if (refunded > 0 && paidP <= 0) return "refunded";
  if (paidP <= 0) return "pending";
  if (paidP < totalP) return "partial";
  return "paid";
}

export function folioTotals(input: {
  charges: ChargeLine[];
  completedPayments: number[];
  refunds: number[];
  /** Booked total (pre-tax) and the current VAT rate — used until room charges are posted. */
  expected: { roomTotal: number; taxRate: number };
}): FolioTotals {
  const active = input.charges.filter((c) => !c.voided);
  const posted = active.length > 0;
  const chargesP = posted
    ? active.reduce((s, c) => s + toPiastres(c.amount), 0)
    : toPiastres(input.expected.roomTotal);
  const taxP = posted
    ? active.reduce((s, c) => s + toPiastres(c.taxAmount), 0)
    : toPiastres(taxFor(input.expected.roomTotal, input.expected.taxRate));
  const paidGrossP = input.completedPayments.reduce((s, p) => s + toPiastres(p), 0);
  const refundedP = input.refunds.reduce((s, r) => s + toPiastres(r), 0);
  const paidP = paidGrossP - refundedP;
  const totalP = chargesP + taxP;
  return {
    charges: fromPiastres(chargesP),
    tax: fromPiastres(taxP),
    total: fromPiastres(totalP),
    paid: fromPiastres(paidP),
    refunded: fromPiastres(refundedP),
    balance: fromPiastres(totalP - paidP),
    paymentStatus: paymentStatusFor(
      fromPiastres(totalP),
      fromPiastres(paidP),
      fromPiastres(refundedP),
    ),
    posted,
  };
}

/**
 * What a not-yet-posted booking is expected to cost (pre-tax). A cancelled booking owes nothing,
 * so any deposit on it becomes a credit to refund. (No-shows keep their booked total: the
 * deposit is not automatically owed back.)
 */
export function expectedRoomTotal(status: string, bookedTotal: number): number {
  return status === "cancelled" ? 0 : bookedTotal;
}

/** Totals from pre-summed ledger figures (list screens: one query for many folios). */
export function totalsFromSums(input: {
  chargeCount: number;
  charges: number;
  tax: number;
  paid: number;
  refunded: number;
  expected: { roomTotal: number; taxRate: number };
}): FolioTotals {
  return folioTotals({
    charges:
      input.chargeCount > 0 ? [{ amount: input.charges, taxAmount: input.tax, voided: false }] : [],
    completedPayments: input.paid > 0 ? [input.paid] : [],
    refunds: input.refunded > 0 ? [input.refunded] : [],
    expected: input.expected,
  });
}

/**
 * Split a refund across the payments it goes back to — most recent first, each limited to what
 * is still refundable on it. Returns null if the payments can't cover the amount.
 */
export function allocateRefund(
  amount: number,
  payments: Array<{ id: string; refundable: number }>,
): Array<{ paymentId: string; amount: number }> | null {
  let leftP = toPiastres(amount);
  const out: Array<{ paymentId: string; amount: number }> = [];
  for (const p of payments) {
    if (leftP <= 0) break;
    const takeP = Math.min(leftP, toPiastres(p.refundable));
    if (takeP <= 0) continue;
    out.push({ paymentId: p.id, amount: fromPiastres(takeP) });
    leftP -= takeP;
  }
  return leftP > 0 ? null : out;
}
