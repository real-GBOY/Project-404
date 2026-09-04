import { httpClient } from "@/lib/api/http-client";

export type InvoiceStatus = "draft" | "issued" | "sent" | "paid" | "void";

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

export interface Money {
  currency: string;
  amount: string;
}

/** Four KPI slots for a finance tab — `a`/`b`/`c` money lists, `d` money or a count. */
export interface FinanceSummary {
  a: Money[];
  b: Money[];
  c: Money[] | string;
  d: Money[] | string;
  overdue?: number;
}

export interface InvoiceLine {
  id: string;
  kind: "fee" | "disbursement";
  description: string;
  amount: number;
}

export interface Invoice {
  id: string;
  number: string;
  clientId: string;
  clientName: string;
  matterId: string | null;
  matterTitle: string | null;
  matterReference: string | null;
  billingPartner: string;
  terms: string;
  status: InvoiceStatus;
  currency: string;
  issuedAt: string | null;
  dueAt: string | null;
  vatRate: number;
  lines: InvoiceLine[];
  totals: { fees: number; disbursements: number; vat: number; total: number; paid: number; balance: number };
  payments: { id: string; amount: number; currency: string; method: string; receivedAt: string; reference: string | null }[];
}

export interface PaymentListItem {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  currency: string;
  method: string;
  receivedAt: string;
  reference: string | null;
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

export const billingKeys = {
  invoices: (status?: string) => ["invoices", "list", status ?? "all"] as const,
  invoice: (id: string) => ["invoices", "detail", id] as const,
  payments: () => ["payments", "list"] as const,
  expenses: (status?: string) => ["expenses", "list", status ?? "all"] as const,
};

export const listInvoices = (status: string | undefined, signal?: AbortSignal) =>
  httpClient<{ items: InvoiceListItem[]; total: number }>("/invoices", { query: { status }, signal });

export const getInvoice = (id: string, signal?: AbortSignal) =>
  httpClient<Invoice>(`/invoices/${id}`, { signal });

export interface NewInvoiceInput {
  clientId: string;
  matterId?: string | null;
  currency?: "EGP" | "AED" | "USD" | "SAR";
  vatRate?: number;
  lines?: { kind: "fee" | "disbursement"; description: string; amount: number }[];
}

export const createInvoice = (body: NewInvoiceInput) =>
  httpClient<Invoice>("/invoices", { method: "POST", body });

export const invoiceAction = (id: string, action: "issue" | "send" | "void") =>
  httpClient<Invoice>(`/invoices/${id}/${action}`, { method: "POST" });

export const listPayments = (signal?: AbortSignal) =>
  httpClient<{ items: PaymentListItem[]; total: number }>("/payments", { signal });

export const recordPayment = (body: {
  invoiceId: string;
  amount: number;
  currency: string;
  method: string;
  reference?: string;
}) => httpClient<unknown>("/payments", { method: "POST", body });

export const listExpenses = (status: string | undefined, signal?: AbortSignal) =>
  httpClient<{ items: ExpenseListItem[]; total: number }>("/expenses", { query: { status }, signal });

export const recordExpense = (body: {
  description: string;
  category: string;
  amount: number;
  currency: string;
  matterId?: string | null;
}) => httpClient<unknown>("/expenses", { method: "POST", body });

export const approveExpense = (id: string) =>
  httpClient<unknown>(`/expenses/${id}/approve`, { method: "POST" });
