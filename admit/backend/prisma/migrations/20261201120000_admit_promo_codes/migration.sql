-- Promo codes: an organizer defines a discount code per event; a guest enters it at checkout.
-- The discount is priced by the server when the booking is created and frozen onto the booking
-- (`total_minor` stays the amount to pay, so payments, revenue and reports need no change).
CREATE TABLE "admit_promo_codes" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "event_id"        TEXT NOT NULL,
  "code"            TEXT NOT NULL,
  "kind"            TEXT NOT NULL,
  "value"           INTEGER NOT NULL,
  "max_uses"        INTEGER,
  "valid_from"      TIMESTAMPTZ(6),
  "valid_until"     TIMESTAMPTZ(6),
  "enabled"         BOOLEAN NOT NULL DEFAULT true,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admit_promo_codes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admit_promo_codes_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "admit_promo_codes_org_fk" FOREIGN KEY ("organization_id")
    REFERENCES "organizations" ("id") ON DELETE CASCADE,
  CONSTRAINT "admit_promo_codes_event_fk" FOREIGN KEY ("organization_id", "event_id")
    REFERENCES "admit_events" ("organization_id", "id") ON DELETE CASCADE,
  CONSTRAINT "admit_promo_codes_kind_check" CHECK ("kind" IN ('percent', 'fixed')),
  CONSTRAINT "admit_promo_codes_value_check" CHECK (
    ("kind" = 'percent' AND "value" BETWEEN 1 AND 99) OR ("kind" = 'fixed' AND "value" >= 1)),
  CONSTRAINT "admit_promo_codes_max_uses_check" CHECK ("max_uses" IS NULL OR "max_uses" >= 1),
  CONSTRAINT "admit_promo_codes_window_check" CHECK (
    "valid_from" IS NULL OR "valid_until" IS NULL OR "valid_until" > "valid_from")
);
-- A code is unique per event, case-insensitively (stored upper-case).
CREATE UNIQUE INDEX "admit_promo_codes_code_uq" ON "admit_promo_codes" ("organization_id", "event_id", "code");

CREATE TRIGGER admit_promo_codes_set_updated_at BEFORE UPDATE ON "admit_promo_codes"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();

ALTER TABLE "admit_promo_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admit_promo_codes" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "admit_promo_codes"
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));

-- What the booking was priced from. Old bookings: no discount, subtotal = total.
ALTER TABLE "admit_bookings" ADD COLUMN "subtotal_minor" INTEGER;
UPDATE "admit_bookings" SET "subtotal_minor" = "total_minor";
ALTER TABLE "admit_bookings" ALTER COLUMN "subtotal_minor" SET NOT NULL;
ALTER TABLE "admit_bookings" ADD COLUMN "discount_minor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "admit_bookings" ADD COLUMN "promo_code_id" TEXT;
ALTER TABLE "admit_bookings" ADD COLUMN "promo_code" TEXT;
ALTER TABLE "admit_bookings" ADD CONSTRAINT "admit_bookings_discount_check"
  CHECK ("discount_minor" >= 0 AND "subtotal_minor" - "discount_minor" = "total_minor");
-- Counting a code's uses is a lookup by promo id.
CREATE INDEX "admit_bookings_promo_idx" ON "admit_bookings" ("organization_id", "promo_code_id")
  WHERE "promo_code_id" IS NOT NULL;
