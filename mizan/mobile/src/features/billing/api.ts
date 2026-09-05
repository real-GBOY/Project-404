import { httpClient } from "@/lib/api/http-client";
import type { ExpenseListItem, FinanceSummary, InvoiceListItem } from "./types";

export const billingKeys = {
  financeSummary: (tab: string) => ["finance", "summary", tab] as const,
  invoices: (status?: string) => ["invoices", "list", status ?? "all"] as const,
  expenses: (status?: string) => ["expenses", "list", status ?? "all"] as const,
};

/** `GET /api/finance/summary?tab=invoices` — same positional a/b/c/d
 *  contract the web Finance page consumes. */
export const getFinanceSummary = (tab: "invoices" | "payments" | "expenses", signal?: AbortSignal) =>
  httpClient<FinanceSummary>("/finance/summary", { query: { tab }, signal });

export const listInvoices = (status: string | undefined, signal?: AbortSignal) =>
  httpClient<{ items: InvoiceListItem[]; total: number }>("/invoices", { query: { status }, signal });

export const listExpenses = (status: string | undefined, signal?: AbortSignal) =>
  httpClient<{ items: ExpenseListItem[]; total: number }>("/expenses", { query: { status }, signal });

/** `POST /api/expenses` — JSON only; there is no receipt-OCR field on this
 *  endpoint (confirmed absent from the backend). */
export const recordExpense = (body: {
  description: string;
  category: string;
  amount: number;
  currency: string;
  matterId?: string | null;
}) => httpClient<unknown>("/expenses", { method: "POST", body });
