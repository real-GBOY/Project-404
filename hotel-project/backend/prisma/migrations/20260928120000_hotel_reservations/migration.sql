-- HotelOS Slice 2 — the reservation engine: pricing (rate rules, discount codes), reservations,
-- their status history, and ROOM ALLOCATIONS — the inventory ledger that makes double booking
-- impossible at the database level (docs/architecture.md §3).
--
-- One allocation table holds every claim on a room's nights: a reservation's stay or (from the
-- operations slice) a maintenance block. A single exclusion constraint over it means no two
-- active claims on one room may overlap — whatever the application does, however many requests
-- race. Stays are half-open daterange [arrival, departure): a departure and the next arrival on
-- the same day do not collide.

-- ===========================================================================
-- Per-tenant counters (human booking codes BK-1001, BK-1002, …)
-- ===========================================================================
CREATE TABLE "hotel_counters" (
  "organization_id" TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "value"           BIGINT NOT NULL,
  CONSTRAINT "hotel_counters_pkey" PRIMARY KEY ("organization_id", "name"),
  CONSTRAINT "hotel_counters_org_fk" FOREIGN KEY ("organization_id")
    REFERENCES "organizations" ("id") ON DELETE CASCADE
);

-- ===========================================================================
-- Pricing — rate rules adjust a room type's base rate per night; the highest-priority rule that
-- applies to a night wins (no stacking). A rule may also impose a minimum stay.
-- ===========================================================================
CREATE TABLE "hotel_rate_rules" (
  "id"               TEXT NOT NULL,
  "organization_id"  TEXT NOT NULL,
  "name"             TEXT NOT NULL,
  "kind"             TEXT NOT NULL,
  "room_type_id"     TEXT,
  "start_date"       DATE,
  "end_date"         DATE,
  "days_of_week"     SMALLINT[],
  "adjustment_type"  TEXT NOT NULL,
  "adjustment_value" NUMERIC(12, 2) NOT NULL,
  "min_nights"       INTEGER,
  "priority"         INTEGER NOT NULL DEFAULT 0,
  "archived_at"      TIMESTAMPTZ(6),
  "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hotel_rate_rules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hotel_rate_rules_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "hotel_rate_rules_room_type_fk" FOREIGN KEY ("organization_id", "room_type_id")
    REFERENCES "hotel_room_types" ("organization_id", "id") ON DELETE CASCADE,
  CONSTRAINT "hotel_rate_rules_kind_check" CHECK ("kind" IN ('seasonal', 'weekend', 'promotion')),
  CONSTRAINT "hotel_rate_rules_adjustment_type_check" CHECK ("adjustment_type" IN ('percent', 'fixed_rate')),
  CONSTRAINT "hotel_rate_rules_adjustment_check" CHECK (
    ("adjustment_type" = 'percent' AND "adjustment_value" > -100 AND "adjustment_value" <= 500)
    OR ("adjustment_type" = 'fixed_rate' AND "adjustment_value" > 0)
  ),
  CONSTRAINT "hotel_rate_rules_dates_check" CHECK (
    "start_date" IS NULL OR "end_date" IS NULL OR "end_date" >= "start_date"
  ),
  CONSTRAINT "hotel_rate_rules_dow_check" CHECK (
    "days_of_week" IS NULL OR ("days_of_week" <@ ARRAY[0,1,2,3,4,5,6]::SMALLINT[] AND cardinality("days_of_week") > 0)
  ),
  CONSTRAINT "hotel_rate_rules_min_nights_check" CHECK ("min_nights" IS NULL OR "min_nights" BETWEEN 1 AND 30)
);
CREATE INDEX "hotel_rate_rules_org_idx" ON "hotel_rate_rules" ("organization_id", "priority");

CREATE TABLE "hotel_discounts" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "code"            TEXT NOT NULL,
  "description"     TEXT,
  "percent_off"     NUMERIC(5, 2) NOT NULL,
  "valid_from"      DATE,
  "valid_to"        DATE,
  "archived_at"     TIMESTAMPTZ(6),
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hotel_discounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hotel_discounts_code_uq" UNIQUE ("organization_id", "code"),
  CONSTRAINT "hotel_discounts_org_fk" FOREIGN KEY ("organization_id")
    REFERENCES "organizations" ("id") ON DELETE CASCADE,
  CONSTRAINT "hotel_discounts_percent_check" CHECK ("percent_off" > 0 AND "percent_off" <= 100),
  CONSTRAINT "hotel_discounts_code_check" CHECK ("code" ~ '^[A-Z0-9-]{3,20}$'),
  CONSTRAINT "hotel_discounts_dates_check" CHECK (
    "valid_from" IS NULL OR "valid_to" IS NULL OR "valid_to" >= "valid_from"
  )
);

-- ===========================================================================
-- Reservations. Status is a state machine enforced by the domain; the CHECK only lists states.
-- Money is a pre-tax room total snapshotted at booking (server-quoted, never client-supplied);
-- tax and extras are added by billing.
-- ===========================================================================
CREATE TABLE "hotel_reservations" (
  "id"                  TEXT NOT NULL,
  "organization_id"     TEXT NOT NULL,
  "code"                TEXT NOT NULL,
  "guest_id"            TEXT NOT NULL,
  "room_type_id"        TEXT NOT NULL,
  "status"              TEXT NOT NULL,
  "source"              TEXT NOT NULL,
  "arrival"             DATE NOT NULL,
  "departure"           DATE NOT NULL,
  "adults"              INTEGER NOT NULL,
  "children"            INTEGER NOT NULL DEFAULT 0,
  "nightly_rates"       JSONB NOT NULL,
  "room_total"          NUMERIC(12, 2) NOT NULL,
  "discount_code"       TEXT,
  "discount_amount"     NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "total"               NUMERIC(12, 2) NOT NULL,
  "notes"               TEXT,
  "cancellation_reason" TEXT,
  "created_by"          TEXT,
  "confirmed_at"        TIMESTAMPTZ(6),
  "checked_in_at"       TIMESTAMPTZ(6),
  "checked_out_at"      TIMESTAMPTZ(6),
  "cancelled_at"        TIMESTAMPTZ(6),
  "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hotel_reservations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hotel_reservations_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "hotel_reservations_code_uq" UNIQUE ("organization_id", "code"),
  CONSTRAINT "hotel_reservations_guest_fk" FOREIGN KEY ("organization_id", "guest_id")
    REFERENCES "hotel_guests" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "hotel_reservations_room_type_fk" FOREIGN KEY ("organization_id", "room_type_id")
    REFERENCES "hotel_room_types" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "hotel_reservations_status_check" CHECK (
    "status" IN ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show')
  ),
  CONSTRAINT "hotel_reservations_source_check" CHECK (
    "source" IN ('direct', 'phone', 'walk_in', 'website', 'booking_com', 'expedia')
  ),
  CONSTRAINT "hotel_reservations_dates_check" CHECK ("departure" > "arrival" AND "departure" - "arrival" <= 60),
  CONSTRAINT "hotel_reservations_occupancy_check" CHECK ("adults" >= 1 AND "children" >= 0),
  CONSTRAINT "hotel_reservations_money_check" CHECK (
    "room_total" >= 0 AND "discount_amount" >= 0 AND "discount_amount" <= "room_total"
    AND "total" = "room_total" - "discount_amount"
  ),
  CONSTRAINT "hotel_reservations_nightly_rates_check" CHECK (
    jsonb_typeof("nightly_rates") = 'array'
    AND jsonb_array_length("nightly_rates") = "departure" - "arrival"
  )
);
CREATE INDEX "hotel_reservations_arrival_idx" ON "hotel_reservations" ("organization_id", "arrival");
CREATE INDEX "hotel_reservations_departure_idx" ON "hotel_reservations" ("organization_id", "departure");
CREATE INDEX "hotel_reservations_status_idx" ON "hotel_reservations" ("organization_id", "status");
CREATE INDEX "hotel_reservations_guest_idx" ON "hotel_reservations" ("organization_id", "guest_id");

-- `seq` orders transitions made in the same transaction (they share CURRENT_TIMESTAMP).
CREATE TABLE "hotel_reservation_status_history" (
  "id"              TEXT NOT NULL,
  "seq"             BIGSERIAL NOT NULL,
  "organization_id" TEXT NOT NULL,
  "reservation_id"  TEXT NOT NULL,
  "from_status"     TEXT,
  "to_status"       TEXT NOT NULL,
  "actor_id"        TEXT,
  "reason"          TEXT,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hotel_reservation_status_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hotel_reservation_status_history_reservation_fk" FOREIGN KEY ("organization_id", "reservation_id")
    REFERENCES "hotel_reservations" ("organization_id", "id") ON DELETE CASCADE
);
CREATE INDEX "hotel_reservation_status_history_idx"
  ON "hotel_reservation_status_history" ("organization_id", "reservation_id", "created_at");

-- ===========================================================================
-- Room allocations — THE inventory ledger. `active` is cleared (in the same transaction) when a
-- claim is released: cancellation, no-show, or the unused nights of an early check-out.
-- ===========================================================================
CREATE TABLE "hotel_room_allocations" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "room_id"         TEXT NOT NULL,
  "kind"            TEXT NOT NULL,
  "reservation_id"  TEXT,
  "stay"            DATERANGE NOT NULL,
  "active"          BOOLEAN NOT NULL DEFAULT true,
  "reason"          TEXT,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hotel_room_allocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hotel_room_allocations_room_fk" FOREIGN KEY ("organization_id", "room_id")
    REFERENCES "hotel_rooms" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "hotel_room_allocations_reservation_fk" FOREIGN KEY ("organization_id", "reservation_id")
    REFERENCES "hotel_reservations" ("organization_id", "id") ON DELETE CASCADE,
  CONSTRAINT "hotel_room_allocations_kind_check" CHECK ("kind" IN ('reservation', 'block')),
  CONSTRAINT "hotel_room_allocations_kind_ref_check" CHECK (("kind" = 'reservation') = ("reservation_id" IS NOT NULL)),
  CONSTRAINT "hotel_room_allocations_stay_check" CHECK (NOT isempty("stay") AND lower_inc("stay") AND NOT upper_inc("stay")),
  -- THE no-double-booking invariant (btree_gist provides `=` on text inside a GiST index).
  CONSTRAINT "hotel_room_allocations_no_overlap" EXCLUDE USING gist (
    "organization_id" WITH =,
    "room_id" WITH =,
    "stay" WITH &&
  ) WHERE ("active")
);
CREATE INDEX "hotel_room_allocations_reservation_idx"
  ON "hotel_room_allocations" ("organization_id", "reservation_id");
CREATE INDEX "hotel_room_allocations_stay_idx"
  ON "hotel_room_allocations" USING gist ("organization_id", "stay") WHERE ("active");

-- ===========================================================================
-- updated_at triggers + RLS
-- ===========================================================================
CREATE TRIGGER hotel_rate_rules_set_updated_at BEFORE UPDATE ON "hotel_rate_rules"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER hotel_discounts_set_updated_at BEFORE UPDATE ON "hotel_discounts"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER hotel_reservations_set_updated_at BEFORE UPDATE ON "hotel_reservations"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER hotel_room_allocations_set_updated_at BEFORE UPDATE ON "hotel_room_allocations"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'hotel_counters', 'hotel_rate_rules', 'hotel_discounts', 'hotel_reservations',
    'hotel_reservation_status_history', 'hotel_room_allocations'
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
