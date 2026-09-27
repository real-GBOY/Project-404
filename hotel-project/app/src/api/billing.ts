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

export interface Folio {
  reservationId: string;
  totals: FolioTotals;
  invoiceId: string | null;
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
    status: "pending" | "completed" | "failed";
    failureReason: string | null;
    receivedByName: string | null;
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
