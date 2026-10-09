-- Admit foundation: settings, venues, events, ticket types, payment methods, event staff scoping.
--
-- Same shape as the Raqib/HotelOS domain migrations: composite (organization_id, id) unique keys and
-- composite FKs (a child tagged with the wrong tenant is rejected by the FK itself), string-union CHECKs,
-- updated_at triggers, list indexes, FORCE'd tenant_isolation RLS on every table. Hand-written;
-- prisma/schema/admit-*.prisma mirror these tables for Kysely type generation only.
--
-- Money is integer minor units (piastres) in the event's currency; times are timestamptz (UTC).

-- ===========================================================================
-- Settings — exactly one row per organization (the organizer). Shape owned by app/admit/settings.
-- ===========================================================================
CREATE TABLE "admit_settings" (
  "organization_id" TEXT NOT NULL,
  "data"            JSONB NOT NULL DEFAULT '{}',
  "updated_by"      TEXT,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admit_settings_pkey" PRIMARY KEY ("organization_id"),
  CONSTRAINT "admit_settings_org_fk" FOREIGN KEY ("organization_id")
    REFERENCES "organizations" ("id") ON DELETE CASCADE,
  CONSTRAINT "admit_settings_data_check" CHECK (jsonb_typeof("data") = 'object')
);

-- ===========================================================================
-- Venues
-- ===========================================================================
CREATE TABLE "admit_venues" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "area"            TEXT NOT NULL DEFAULT '',
  "address"         TEXT NOT NULL DEFAULT '',
  "map_url"         TEXT,
  "capacity"        INTEGER NOT NULL,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admit_venues_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admit_venues_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "admit_venues_org_fk" FOREIGN KEY ("organization_id")
    REFERENCES "organizations" ("id") ON DELETE CASCADE,
  CONSTRAINT "admit_venues_capacity_check" CHECK ("capacity" > 0)
);

-- ===========================================================================
-- Events. `slug` is unique per organizer and is what the public site addresses.
-- ===========================================================================
CREATE TABLE "admit_events" (
  "id"                  TEXT NOT NULL,
  "organization_id"     TEXT NOT NULL,
  "slug"                TEXT NOT NULL,
  "title"               TEXT NOT NULL,
  "category"            TEXT NOT NULL DEFAULT '',
  "description"         TEXT NOT NULL DEFAULT '',
  "venue_id"            TEXT NOT NULL,
  "starts_at"           TIMESTAMPTZ(6) NOT NULL,
  "ends_at"             TIMESTAMPTZ(6) NOT NULL,
  "cover_url"           TEXT,
  "status"              TEXT NOT NULL DEFAULT 'draft',
  "max_per_booking"     INTEGER NOT NULL DEFAULT 6,
  "named_tickets"       BOOLEAN NOT NULL DEFAULT false,
  "hold_hours"          INTEGER NOT NULL DEFAULT 24,
  "allow_resubmission"  BOOLEAN NOT NULL DEFAULT true,
  "currency"            TEXT NOT NULL DEFAULT 'EGP',
  "support_email"       TEXT,
  "policies"            JSONB NOT NULL DEFAULT '{}',
  "program"             JSONB NOT NULL DEFAULT '[]',
  "published_at"        TIMESTAMPTZ(6),
  "created_by"          TEXT,
  "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admit_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admit_events_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "admit_events_slug_uq" UNIQUE ("organization_id", "slug"),
  CONSTRAINT "admit_events_org_fk" FOREIGN KEY ("organization_id")
    REFERENCES "organizations" ("id") ON DELETE CASCADE,
  CONSTRAINT "admit_events_venue_fk" FOREIGN KEY ("organization_id", "venue_id")
    REFERENCES "admit_venues" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "admit_events_status_check" CHECK ("status" IN ('draft', 'published', 'cancelled', 'archived')),
  CONSTRAINT "admit_events_slug_check" CHECK ("slug" ~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$'),
  CONSTRAINT "admit_events_window_check" CHECK ("ends_at" > "starts_at"),
  CONSTRAINT "admit_events_max_check" CHECK ("max_per_booking" BETWEEN 1 AND 6),
  CONSTRAINT "admit_events_hold_check" CHECK ("hold_hours" BETWEEN 1 AND 168),
  CONSTRAINT "admit_events_policies_check" CHECK (jsonb_typeof("policies") = 'object'),
  CONSTRAINT "admit_events_program_check" CHECK (jsonb_typeof("program") = 'array')
);
CREATE INDEX "admit_events_list_idx" ON "admit_events" ("organization_id", "status", "starts_at");

-- ===========================================================================
-- Ticket types — `quantity` is the total inventory. Sold/held counts are derived from live
-- booking lines under a row lock on this table (see bookings), never stored, so they cannot drift.
-- ===========================================================================
CREATE TABLE "admit_ticket_types" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "event_id"        TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "description"     TEXT NOT NULL DEFAULT '',
  "price_minor"     INTEGER NOT NULL,
  "quantity"        INTEGER NOT NULL,
  "max_per_booking" INTEGER NOT NULL DEFAULT 6,
  "on_sale"         BOOLEAN NOT NULL DEFAULT true,
  "sort_order"      INTEGER NOT NULL DEFAULT 0,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admit_ticket_types_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admit_ticket_types_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "admit_ticket_types_org_fk" FOREIGN KEY ("organization_id")
    REFERENCES "organizations" ("id") ON DELETE CASCADE,
  CONSTRAINT "admit_ticket_types_event_fk" FOREIGN KEY ("organization_id", "event_id")
    REFERENCES "admit_events" ("organization_id", "id") ON DELETE CASCADE,
  CONSTRAINT "admit_ticket_types_price_check" CHECK ("price_minor" >= 0),
  CONSTRAINT "admit_ticket_types_qty_check" CHECK ("quantity" >= 0),
  CONSTRAINT "admit_ticket_types_max_check" CHECK ("max_per_booking" BETWEEN 1 AND 6)
);
CREATE INDEX "admit_ticket_types_event_idx" ON "admit_ticket_types" ("organization_id", "event_id", "sort_order");

-- ===========================================================================
-- Manual payment methods an event accepts (bank transfer, wallet, instant payment …).
-- ===========================================================================
CREATE TABLE "admit_payment_methods" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "event_id"        TEXT NOT NULL,
  "type"            TEXT NOT NULL,
  "label"           TEXT NOT NULL,
  "recipient_name"  TEXT NOT NULL,
  "identifier"      TEXT NOT NULL,
  "instructions"    JSONB NOT NULL DEFAULT '[]',
  "enabled"         BOOLEAN NOT NULL DEFAULT true,
  "sort_order"      INTEGER NOT NULL DEFAULT 0,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admit_payment_methods_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admit_payment_methods_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "admit_payment_methods_org_fk" FOREIGN KEY ("organization_id")
    REFERENCES "organizations" ("id") ON DELETE CASCADE,
  CONSTRAINT "admit_payment_methods_event_fk" FOREIGN KEY ("organization_id", "event_id")
    REFERENCES "admit_events" ("organization_id", "id") ON DELETE CASCADE,
  CONSTRAINT "admit_payment_methods_type_check" CHECK ("type" IN ('instapay', 'wallet', 'bank', 'cash_deposit', 'other')),
  CONSTRAINT "admit_payment_methods_instr_check" CHECK (jsonb_typeof("instructions") = 'array')
);
CREATE INDEX "admit_payment_methods_event_idx" ON "admit_payment_methods" ("organization_id", "event_id", "sort_order");

-- ===========================================================================
-- Event staff — which people may work which events. A person holding the `read:event-all`
-- permission sees every event of the organizer; everyone else is limited to the events here.
-- ===========================================================================
CREATE TABLE "admit_event_staff" (
  "organization_id" TEXT NOT NULL,
  "event_id"        TEXT NOT NULL,
  "user_id"         TEXT NOT NULL,
  "gate"            TEXT NOT NULL DEFAULT '',
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admit_event_staff_pkey" PRIMARY KEY ("organization_id", "event_id", "user_id"),
  CONSTRAINT "admit_event_staff_event_fk" FOREIGN KEY ("organization_id", "event_id")
    REFERENCES "admit_events" ("organization_id", "id") ON DELETE CASCADE,
  CONSTRAINT "admit_event_staff_user_fk" FOREIGN KEY ("user_id")
    REFERENCES "users" ("id") ON DELETE CASCADE
);
CREATE INDEX "admit_event_staff_user_idx" ON "admit_event_staff" ("organization_id", "user_id");

-- ===========================================================================
-- updated_at triggers
-- ===========================================================================
CREATE TRIGGER admit_settings_set_updated_at BEFORE UPDATE ON "admit_settings"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER admit_venues_set_updated_at BEFORE UPDATE ON "admit_venues"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER admit_events_set_updated_at BEFORE UPDATE ON "admit_events"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER admit_ticket_types_set_updated_at BEFORE UPDATE ON "admit_ticket_types"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER admit_payment_methods_set_updated_at BEFORE UPDATE ON "admit_payment_methods"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();

-- ===========================================================================
-- Row-level security — tenant_isolation on every table above.
-- ===========================================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['admit_settings', 'admit_venues', 'admit_events', 'admit_ticket_types',
                           'admit_payment_methods', 'admit_event_staff']
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
