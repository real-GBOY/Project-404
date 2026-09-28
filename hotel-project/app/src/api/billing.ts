import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ENDPOINTS, http } from "@/config";
import { reservationKeys } from "./reservations";

export type PaymentMethod = "cash" | "card" | "bank_transfer" | "online";
export type PaymentStatus = "pending" | "partial" | "paid" | "refunded";
export type ChargeKind =
  "room" | "breakfast" | "extra_bed" | "minibar" | "laundry" | "transfer" | "service";

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank Transfer",
  online: "Online",
};

export const EXTRA_KINDS: Array<{ kind: Exclude<ChargeKind, "room">; label: string }> = [
  { kind: "breakfast", label: "Breakfast" },
  { kind: "extra_bed", label: "Extra bed" },
  { kind: "minibar", label: "Minibar" },
  { kind: "laundry", label: "Laundry" },
  { kind: "transfer", label: "Airport transfer" },
  { kind: "service", label: "Other service" },
];

export interface FolioTotals {
  charges: number;
  tax: number;
  total: number;
  paid: number;
  refunded: number;
  balance: number;
  paymentStatus: PaymentStatus;
  posted: boolean;
}

export type MoneyStatus = "pending" | "completed" | "failed";

export interface Refund {
  id: string;
  paymentId: string;
  method: PaymentMethod;
  amount: number;
  reason: string;
  status: MoneyStatus;
  failureReason: string | null;
  refundedByName: string | null;
  businessDate: string;
  createdAt: string;
}

export interface Folio {
  reservationId: string;
  totals: FolioTotals;
  /** What is owed back to the guest now (credit less refunds in flight). */
  credit: number;
  invoiceId: string | null;
  invoices: Array<{ id: string; number: string; status: "issued" | "void"; total: number }>;
  refunds: Refund[];
  charges: Array<{
    id: string;
    kind: ChargeKind;
    description: string;
    serviceDate: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    taxAmount: number;
    invoiceId: string | null;
    voidedAt: string | null;
    voidReason: string | null;
  }>;
  payments: Array<{
    id: string;
    method: PaymentMethod;
    amount: number;
    status: MoneyStatus;
    failureReason: string | null;
    /** Still refundable on this payment. */
    refundable: number;
    receivedByName: string | null;
    businessDate: string;
    createdAt: string;
  }>;
}

export interface Invoice {
  id: string;
  number: string;
  status: "issued" | "void";
  subtotal: number;
  tax: number;
  total: number;
  taxRate: number;
  billToName: string;
  issuedAt: string;
  voidedAt: string | null;
  voidReason: string | null;
  items: Array<{
    description: string;
    serviceDate: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    taxAmount: number;
  }>;
  reservation: {
    id: string;
    code: string;
    roomNumber: string | null;
    roomTypeName: string;
    arrival: string;
    departure: string;
  };
}

/** A fresh key per payment ATTEMPT: a retry of the same attempt reuses it and can't charge twice. */
export function newIdempotencyKey(): string {
  return `pay_${crypto.randomUUID()}`;
}

export const billingKeys = {
  folio: (id: string) => ["folio", id] as const,
  invoice: (id: string) => ["invoice", id] as const,
  folios: (ids: string[]) => ["folio-summaries", ids] as const,
  finance: ["finance"] as const,
};

export function useFolio(reservationId: string, enabled = true) {
  return useQuery({
    queryKey: billingKeys.folio(reservationId),
    queryFn: () => http<Folio>(ENDPOINTS.billing.folio(reservationId)),
    enabled,
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: billingKeys.invoice(id),
    queryFn: () => http<Invoice>(ENDPOINTS.billing.invoice(id)),
  });
}

function useInvalidateFolio(reservationId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: billingKeys.folio(reservationId) });
    void qc.invalidateQueries({ queryKey: ["front-desk"] });
    void qc.invalidateQueries({ queryKey: reservationKeys.all });
    void qc.invalidateQueries({ queryKey: ["folio-summaries"] });
    void qc.invalidateQueries({ queryKey: billingKeys.finance });
    void qc.invalidateQueries({ queryKey: ["invoice"] });
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
}

export function useCollectPayment(reservationId: string) {
  const invalidate = useInvalidateFolio(reservationId);
  return useMutation({
    mutationFn: (input: { method: PaymentMethod; amount: number; idempotencyKey: string }) =>
      http<Folio["payments"][number]>(ENDPOINTS.billing.payments(reservationId), {
        method: "POST",
        body: { method: input.method, amount: input.amount },
        headers: { "Idempotency-Key": input.idempotencyKey },
      }),
    onSuccess: invalidate,
  });
}

export function usePostCharge(reservationId: string) {
  const invalidate = useInvalidateFolio(reservationId);
  return useMutation({
    mutationFn: (input: {
      kind: ChargeKind;
      description: string;
      quantity: number;
      unitPrice: number;
    }) => http(ENDPOINTS.billing.charges(reservationId), { method: "POST", body: input }),
    onSuccess: invalidate,
  });
}

export function useVoidCharge(reservationId: string) {
  const invalidate = useInvalidateFolio(reservationId);
  return useMutation({
    mutationFn: ({ chargeId, reason }: { chargeId: string; reason: string }) =>
      http(ENDPOINTS.billing.voidCharge(chargeId), { method: "POST", body: { reason } }),
    onSuccess: invalidate,
  });
}

export function useRefund(reservationId: string) {
  const invalidate = useInvalidateFolio(reservationId);
  return useMutation({
    mutationFn: (input: {
      amount: number;
      reason: string;
      paymentId?: string | null;
      idempotencyKey: string;
    }) =>
      http<{ items: Refund[] }>(ENDPOINTS.billing.refunds(reservationId), {
        method: "POST",
        body: { amount: input.amount, reason: input.reason, paymentId: input.paymentId ?? null },
        headers: { "Idempotency-Key": input.idempotencyKey },
      }),
    onSuccess: invalidate,
  });
}

export function useVoidInvoice(reservationId: string) {
  const invalidate = useInvalidateFolio(reservationId);
  return useMutation({
    mutationFn: ({ invoiceId, reason }: { invoiceId: string; reason: string }) =>
      http(ENDPOINTS.billing.voidInvoice(invoiceId), { method: "POST", body: { reason } }),
    onSuccess: invalidate,
  });
}

export function useReissueInvoice(reservationId: string) {
  const invalidate = useInvalidateFolio(reservationId);
  return useMutation({
    mutationFn: () =>
      http<{ invoiceId: string }>(ENDPOINTS.billing.reissue(reservationId), { method: "POST" }),
    onSuccess: invalidate,
  });
}

// ─── finance screens ────────────────────────────────────────────────────────

export interface InvoiceListItem {
  id: string;
  number: string;
  reservationId: string;
  reservationCode: string;
  billToName: string;
  total: number;
  status: "issued" | "void";
  issuedAt: string;
}

export function useInvoices(params: { status?: "issued" | "void"; q?: string }) {
  return useQuery({
    queryKey: [...billingKeys.finance, "invoices", params],
    queryFn: async () =>
      (await http<{ items: InvoiceListItem[] }>(ENDPOINTS.billing.invoices, { query: params }))
        .items,
  });
}

export interface LedgerEntry {
  id: string;
  kind: "payment" | "refund";
  reservationId: string;
  reservationCode: string;
  guestName: string;
  method: PaymentMethod;
  amount: number;
  status: MoneyStatus;
  actorName: string | null;
  businessDate: string;
  createdAt: string;
}

export function useLedger(params: {
  kind?: "payment" | "refund";
  method?: PaymentMethod;
  q?: string;
}) {
  return useQuery({
    queryKey: [...billingKeys.finance, "ledger", params],
    queryFn: async () =>
      (await http<{ items: LedgerEntry[] }>(ENDPOINTS.finance.ledger, { query: params })).items,
  });
}

export interface FinanceSummary {
  date: string;
  today: { collected: number; refunded: number };
  month: { collected: number; refunded: number; net: number };
  pendingCount: number;
  outstanding: number;
  credits: number;
  openFolios: number;
}

export function useFinanceSummary() {
  return useQuery({
    queryKey: [...billingKeys.finance, "summary"],
    queryFn: () => http<FinanceSummary>(ENDPOINTS.finance.summary),
  });
}

export interface BalanceRow {
  reservationId: string;
  code: string;
  status: string;
  guestName: string;
  roomNumber: string | null;
  arrival: string;
  departure: string;
  total: number;
  paid: number;
  balance: number;
  kind: "due" | "credit";
}

export function useBalances() {
  return useQuery({
    queryKey: [...billingKeys.finance, "balances"],
    queryFn: async () => (await http<{ items: BalanceRow[] }>(ENDPOINTS.finance.balances)).items,
  });
}

/** Payment state for many reservations at once (the reservations list's payment column). */
export function useFolioSummaries(ids: string[], enabled: boolean) {
  return useQuery({
    queryKey: billingKeys.folios(ids),
    queryFn: async () =>
      (
        await http<{ items: Array<FolioTotals & { reservationId: string }> }>(
          ENDPOINTS.billing.folios,
          { query: { ids: ids.join(",") } },
        )
      ).items,
    enabled: enabled && ids.length > 0,
  });
}
