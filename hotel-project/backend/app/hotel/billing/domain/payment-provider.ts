/**
 * The seam between the billing domain and whoever actually moves money. The billing service only
 * ever talks to this interface: v1 binds `SimulatedPaymentProvider`; a `PaymobPaymentProvider`
 * (or any gateway) can be bound later without touching the domain — see billing.module.ts.
 *
 * A provider is called OUTSIDE the database transaction (a network call must never hold row locks
 * open); the payment row is written `pending` before the call and resolved after it.
 */
export type PaymentMethod = "cash" | "card" | "bank_transfer" | "online";

export interface PaymentRequest {
  /** Our payment id — the idempotency reference a real gateway would receive. */
  reference: string;
  amount: number;
  currency: "EGP";
  method: PaymentMethod;
  description: string;
}

export interface PaymentResult {
  status: "completed" | "failed";
  providerReference: string | null;
  failureReason: string | null;
}

export interface PaymentProvider {
  readonly name: string;
  charge(request: PaymentRequest): Promise<PaymentResult>;
}

export const PAYMENT_PROVIDER = Symbol("hotel.paymentProvider");
