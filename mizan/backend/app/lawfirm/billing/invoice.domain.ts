import type { InvoiceLineRow } from "./billing-repository.js";

export interface InvoiceTotals {
  fees: number;
  disbursements: number;
  vat: number;
  total: number;
  paid: number;
  balance: number;
}

/**
 * Server-authoritative invoice totals (README §6). Ported verbatim from
 * `mizan/web/src/mocks/fixtures/db.ts#invoiceTotals`:
 * total = fees + disbursements + round(fees * vatRate); balance = total − paid.
 */
export function invoiceTotals(
  invoice: { lines: InvoiceLineRow[]; vatRate: number },
  paidAmount: number,
): InvoiceTotals {
  const fees = invoice.lines.filter((l) => l.kind === "fee").reduce((s, l) => s + l.amount, 0);
  const disbursements = invoice.lines
    .filter((l) => l.kind === "disbursement")
    .reduce((s, l) => s + l.amount, 0);
  const vat = Math.round(fees * invoice.vatRate);
  const total = fees + disbursements + vat;
  return { fees, disbursements, vat, total, paid: paidAmount, balance: total - paidAmount };
}
