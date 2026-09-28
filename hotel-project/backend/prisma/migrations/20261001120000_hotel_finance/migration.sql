-- HotelOS Slice 5 — finance: refunds as their own ledger rows, and invoice voiding.

-- ===========================================================================
-- Refunds — money returned against a specific completed payment. Like payments they are written
-- `pending` before the provider is called and resolved after; the folio counts only `completed`.
CREATE TABLE "hotel_refunds" (
  "id"                 TEXT NOT NULL,
  "organization_id"    TEXT NOT NULL,
  "reservation_id"     TEXT NOT NULL,
  "payment_id"         TEXT NOT NULL,
  "method"             TEXT NOT NULL,
  "amount"             NUMERIC(12, 2) NOT NULL,
  "reason"             TEXT NOT NULL,
  "status"             TEXT NOT NULL,
  "provider"           TEXT NOT NULL,
  "provider_reference" TEXT,
  "failure_reason"     TEXT,
  "idempotency_key"    TEXT NOT NULL,
  "business_date"      DATE NOT NULL,
  "refunded_by"        TEXT,
  "created_at"         TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at"       TIMESTAMPTZ(6),
  CONSTRAINT "hotel_refunds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hotel_refunds_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "hotel_refunds_idempotency_uq" UNIQUE ("organization_id", "idempotency_key"),
  CONSTRAINT "hotel_refunds_reservation_fk" FOREIGN KEY ("organization_id", "reservation_id")
    REFERENCES "hotel_reservations" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "hotel_refunds_payment_fk" FOREIGN KEY ("organization_id", "payment_id")
    REFERENCES "hotel_payments" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "hotel_refunds_method_check" CHECK ("method" IN ('cash', 'card', 'bank_transfer', 'online')),
  CONSTRAINT "hotel_refunds_status_check" CHECK ("status" IN ('pending', 'completed', 'failed')),
  CONSTRAINT "hotel_refunds_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "hotel_refunds_completion_check" CHECK (("status" = 'completed') = ("completed_at" IS NOT NULL))
);
CREATE INDEX "hotel_refunds_reservation_idx" ON "hotel_refunds" ("organization_id", "reservation_id");
CREATE INDEX "hotel_refunds_payment_idx" ON "hotel_refunds" ("organization_id", "payment_id");
-- Money belongs to the hotel's business date (the day it was taken at the desk), not to a server
-- timestamp: daily takings and the ledger are reported by it.
ALTER TABLE "hotel_payments" ADD COLUMN "business_date" DATE;
UPDATE "hotel_payments" SET "business_date" = ("created_at" AT TIME ZONE 'Africa/Cairo')::date;
ALTER TABLE "hotel_payments" ALTER COLUMN "business_date" SET NOT NULL;
CREATE INDEX "hotel_payments_business_date_idx" ON "hotel_payments" ("organization_id", "business_date");
CREATE INDEX "hotel_refunds_business_date_idx" ON "hotel_refunds" ("organization_id", "business_date");
CREATE INDEX "hotel_invoices_issued_idx" ON "hotel_invoices" ("organization_id", "issued_at");

-- Who voided an invoice (the reason and time already exist).
ALTER TABLE "hotel_invoices" ADD COLUMN "voided_by" TEXT;

DO $$
BEGIN
  ALTER TABLE "hotel_refunds" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "hotel_refunds" FORCE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON "hotel_refunds"
    USING (organization_id = current_setting('app.organization_id', true))
    WITH CHECK (organization_id = current_setting('app.organization_id', true));
END $$;
