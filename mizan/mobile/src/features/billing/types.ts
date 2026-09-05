import type { Money } from "@/types/api";

export type InvoiceStatus = "draft" | "issued" | "sent" | "paid" | "void";

/** Ported from mizan/web/src/features/billing/api/billing.api.ts. */
export interface InvoiceListItem {
  id: string;
  number: string;
  clientName: string;
  matterTitle: string | null;
  matterReference: string | null;
  status: InvoiceStatus;
  currency: string;
  total: number;
  balance: number;
  issuedAt: string | null;
  dueAt: string | null;
}

/** Four KPI slots for a finance tab — `a`/`b`/`c` money lists, `d` money or a
 *  count. Field meaning is positional and tab-dependent (no semantic names
 *  from the backend) — for `tab=invoices`: a=billed, b=collected,
 *  c=outstanding (+ `overdue` count), d=unbilled. */
export interface FinanceSummary {
  a: Money[];
  b: Money[];
  c: Money[] | string;
  d: Money[] | string;
  overdue?: number;
}

export interface ExpenseListItem {
  id: string;
  reference: string;
  description: string;
  category: string;
  matterTitle: string | null;
  matterReference: string | null;
  amount: number;
  currency: string;
  status: "pending" | "approved" | "rejected";
  incurredAt: string;
  submittedBy: string | null;
}
