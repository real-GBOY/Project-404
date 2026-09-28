-- HotelOS Slice 3 — front desk: the guest folio (charges), payments, invoices, and housekeeping
-- tasks (created by check-out, required clean for check-in).
--
-- Financial truth is a ledger (docs/architecture.md §4): balance = Σ charges (+ their VAT)
-- − Σ completed payments + Σ refunds. There is no "paid" flag anywhere. VAT is stored PER CHARGE
-- at the rate in force when it was posted, so a later rate change never rewrites history.

-- ===========================================================================
-- Folio charges
-- ===========================================================================
CREATE TABLE "hotel_folio_charges" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "reservation_id"  TEXT NOT NULL,
  "kind"            TEXT NOT NULL,
  "description"     TEXT NOT NULL,
  "service_date"    DATE NOT NULL,
  "quantity"        INTEGER NOT NULL,
  "unit_price"      NUMERIC(12, 2) NOT NULL,
  "amount"          NUMERIC(12, 2) NOT NULL,
  "tax_amount"      NUMERIC(12, 2) NOT NULL,
  "invoice_id"      TEXT,
  "voided_at"       TIMESTAMPTZ(6),
  "void_reason"     TEXT,
  "created_by"      TEXT,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hotel_folio_charges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hotel_folio_charges_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "hotel_folio_charges_reservation_fk" FOREIGN KEY ("organization_id", "reservation_id")
    REFERENCES "hotel_reservations" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "hotel_folio_charges_kind_check" CHECK (
    "kind" IN ('room', 'breakfast', 'extra_bed', 'minibar', 'laundry', 'transfer', 'service')
  ),
  CONSTRAINT "hotel_folio_charges_quantity_check" CHECK ("quantity" BETWEEN 1 AND 100),
  CONSTRAINT "hotel_folio_charges_money_check" CHECK (
    "unit_price" >= 0 AND "amount" = "quantity" * "unit_price" AND "tax_amount" >= 0
  ),
  CONSTRAINT "hotel_folio_charges_void_check" CHECK (("voided_at" IS NULL) = ("void_reason" IS NULL))
);
CREATE INDEX "hotel_folio_charges_reservation_idx"
  ON "hotel_folio_charges" ("organization_id", "reservation_id");

-- ===========================================================================
-- Payments. Written PENDING before the provider is called (outside the DB transaction), then
-- completed/failed with the provider's answer. The idempotency key makes a retried request a
-- no-op instead of a second charge.
-- ===========================================================================
CREATE TABLE "hotel_payments" (
  "id"                 TEXT NOT NULL,
  "organization_id"    TEXT NOT NULL,
  "reservation_id"     TEXT NOT NULL,
  "invoice_id"         TEXT,
  "method"             TEXT NOT NULL,
  "amount"             NUMERIC(12, 2) NOT NULL,
  "status"             TEXT NOT NULL,
  "provider"           TEXT NOT NULL,
  "provider_reference" TEXT,
  "failure_reason"     TEXT,
  "idempotency_key"    TEXT NOT NULL,
  "received_by"        TEXT,
  "created_at"         TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at"       TIMESTAMPTZ(6),
  CONSTRAINT "hotel_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hotel_payments_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "hotel_payments_idempotency_uq" UNIQUE ("organization_id", "idempotency_key"),
  CONSTRAINT "hotel_payments_reservation_fk" FOREIGN KEY ("organization_id", "reservation_id")
    REFERENCES "hotel_reservations" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "hotel_payments_method_check" CHECK ("method" IN ('cash', 'card', 'bank_transfer', 'online')),
  CONSTRAINT "hotel_payments_status_check" CHECK ("status" IN ('pending', 'completed', 'failed')),
  CONSTRAINT "hotel_payments_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "hotel_payments_completion_check" CHECK (("status" = 'completed') = ("completed_at" IS NOT NULL))
);
CREATE INDEX "hotel_payments_reservation_idx" ON "hotel_payments" ("organization_id", "reservation_id");

-- ===========================================================================
-- Invoices — issued at check-out; items are a frozen snapshot of the folio at issue time.
-- ===========================================================================
CREATE TABLE "hotel_invoices" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "number"          TEXT NOT NULL,
  "reservation_id"  TEXT NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'issued',
  "subtotal"        NUMERIC(12, 2) NOT NULL,
  "tax"             NUMERIC(12, 2) NOT NULL,
  "total"           NUMERIC(12, 2) NOT NULL,
  "tax_rate"        NUMERIC(5, 4) NOT NULL,
  "bill_to_name"    TEXT NOT NULL,
  "issued_by"       TEXT,
  "issued_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "voided_at"       TIMESTAMPTZ(6),
  "void_reason"     TEXT,
  CONSTRAINT "hotel_invoices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hotel_invoices_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "hotel_invoices_number_uq" UNIQUE ("organization_id", "number"),
  CONSTRAINT "hotel_invoices_reservation_fk" FOREIGN KEY ("organization_id", "reservation_id")
    REFERENCES "hotel_reservations" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "hotel_invoices_status_check" CHECK ("status" IN ('issued', 'void')),
  CONSTRAINT "hotel_invoices_money_check" CHECK ("subtotal" >= 0 AND "tax" >= 0 AND "total" = "subtotal" + "tax"),
  CONSTRAINT "hotel_invoices_void_check" CHECK (("status" = 'void') = ("voided_at" IS NOT NULL))
);
-- At most one live (issued) invoice per reservation.
CREATE UNIQUE INDEX "hotel_invoices_one_issued_uq"
  ON "hotel_invoices" ("organization_id", "reservation_id") WHERE ("status" = 'issued');

CREATE TABLE "hotel_invoice_items" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "invoice_id"      TEXT NOT NULL,
  "charge_id"       TEXT NOT NULL,
  "description"     TEXT NOT NULL,
  "service_date"    DATE NOT NULL,
  "quantity"        INTEGER NOT NULL,
  "unit_price"      NUMERIC(12, 2) NOT NULL,
  "amount"          NUMERIC(12, 2) NOT NULL,
  "tax_amount"      NUMERIC(12, 2) NOT NULL,
  "position"        INTEGER NOT NULL,
  CONSTRAINT "hotel_invoice_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hotel_invoice_items_invoice_fk" FOREIGN KEY ("organization_id", "invoice_id")
    REFERENCES "hotel_invoices" ("organization_id", "id") ON DELETE CASCADE,
  CONSTRAINT "hotel_invoice_items_charge_fk" FOREIGN KEY ("organization_id", "charge_id")
    REFERENCES "hotel_folio_charges" ("organization_id", "id") ON DELETE RESTRICT
);
CREATE INDEX "hotel_invoice_items_invoice_idx" ON "hotel_invoice_items" ("organization_id", "invoice_id", "position");

ALTER TABLE "hotel_folio_charges" ADD CONSTRAINT "hotel_folio_charges_invoice_fk"
  FOREIGN KEY ("organization_id", "invoice_id") REFERENCES "hotel_invoices" ("organization_id", "id");
ALTER TABLE "hotel_payments" ADD CONSTRAINT "hotel_payments_invoice_fk"
  FOREIGN KEY ("organization_id", "invoice_id") REFERENCES "hotel_invoices" ("organization_id", "id");

-- ===========================================================================
-- Housekeeping tasks. A room has at most one OPEN task at a time.
-- ===========================================================================
CREATE TABLE "hotel_housekeeping_tasks" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "room_id"         TEXT NOT NULL,
  "reservation_id"  TEXT,
  "kind"            TEXT NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'pending',
  "priority"        TEXT NOT NULL DEFAULT 'normal',
  "assignee_id"     TEXT,
  "notes"           TEXT,
  "due_date"        DATE NOT NULL,
  "started_at"      TIMESTAMPTZ(6),
  "completed_at"    TIMESTAMPTZ(6),
  "inspected_at"    TIMESTAMPTZ(6),
  "inspected_by"    TEXT,
  "created_by"      TEXT,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hotel_housekeeping_tasks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hotel_housekeeping_tasks_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "hotel_housekeeping_tasks_room_fk" FOREIGN KEY ("organization_id", "room_id")
    REFERENCES "hotel_rooms" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "hotel_housekeeping_tasks_reservation_fk" FOREIGN KEY ("organization_id", "reservation_id")
    REFERENCES "hotel_reservations" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "hotel_housekeeping_tasks_kind_check" CHECK ("kind" IN ('checkout_clean', 'stayover', 'deep_clean')),
  CONSTRAINT "hotel_housekeeping_tasks_status_check" CHECK (
    "status" IN ('pending', 'assigned', 'in_progress', 'completed', 'inspected')
  ),
  CONSTRAINT "hotel_housekeeping_tasks_priority_check" CHECK ("priority" IN ('low', 'normal', 'high')),
  CONSTRAINT "hotel_housekeeping_tasks_assignee_check" CHECK (
    "status" = 'pending' OR "assignee_id" IS NOT NULL
  )
);
CREATE UNIQUE INDEX "hotel_housekeeping_tasks_one_open_uq"
  ON "hotel_housekeeping_tasks" ("organization_id", "room_id")
  WHERE ("status" IN ('pending', 'assigned', 'in_progress'));
CREATE INDEX "hotel_housekeeping_tasks_status_idx"
  ON "hotel_housekeeping_tasks" ("organization_id", "status", "due_date");

CREATE TRIGGER hotel_housekeeping_tasks_set_updated_at BEFORE UPDATE ON "hotel_housekeeping_tasks"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();

-- ===========================================================================
-- RLS
-- ===========================================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'hotel_folio_charges', 'hotel_payments', 'hotel_invoices', 'hotel_invoice_items',
    'hotel_housekeeping_tasks'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (organization_id = current_setting(''app.organization_id'', true))
         WITH CHECK (organization_id = current_setting(''app.organization_id'', true))',
      t
    );
  END LOOP;
END $$;
