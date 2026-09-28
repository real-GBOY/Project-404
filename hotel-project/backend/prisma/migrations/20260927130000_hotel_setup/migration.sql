-- HotelOS Slice 1 — property setup: hotel settings, room types, rooms, guests.
--
-- Same shape as Atlas/Mizan domain migrations: composite (organization_id, id) unique keys and
-- composite FKs (a child tagged with the wrong tenant is rejected by the FK itself), string-union
-- CHECKs, updated_at triggers, list indexes, and FORCE'd tenant_isolation RLS on every table.
-- Grants come from the Core baseline's ALTER DEFAULT PRIVILEGES. Hand-written; the
-- prisma/schema/hotel-*.prisma models mirror these tables for Kysely type generation only.

-- ===========================================================================
-- Hotel settings — exactly one row per organization (v1: one property per org).
-- ===========================================================================
CREATE TABLE "hotel_settings" (
  "organization_id" TEXT NOT NULL,
  "hotel_name"      TEXT NOT NULL,
  "time_zone"       TEXT NOT NULL DEFAULT 'Africa/Cairo',
  "currency"        TEXT NOT NULL DEFAULT 'EGP',
  "check_in_time"   TEXT NOT NULL DEFAULT '14:00',
  "check_out_time"  TEXT NOT NULL DEFAULT '12:00',
  "tax_rate"        NUMERIC(5, 4) NOT NULL DEFAULT 0.14,
  "address"         TEXT,
  "phone"           TEXT,
  "email"           TEXT,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hotel_settings_pkey" PRIMARY KEY ("organization_id"),
  CONSTRAINT "hotel_settings_org_fk" FOREIGN KEY ("organization_id")
    REFERENCES "organizations" ("id") ON DELETE CASCADE,
  CONSTRAINT "hotel_settings_currency_check" CHECK ("currency" IN ('EGP')),
  CONSTRAINT "hotel_settings_tax_rate_check" CHECK ("tax_rate" >= 0 AND "tax_rate" < 1),
  CONSTRAINT "hotel_settings_check_in_time_check" CHECK ("check_in_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT "hotel_settings_check_out_time_check" CHECK ("check_out_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT "hotel_settings_name_check" CHECK (length(btrim("hotel_name")) > 0)
);

-- ===========================================================================
-- Room types — the sellable categories (Standard, Deluxe, Suite, Family…).
-- ===========================================================================
CREATE TABLE "hotel_room_types" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "code"            TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "description"     TEXT,
  "capacity"        INTEGER NOT NULL,
  "beds"            TEXT NOT NULL,
  "base_rate"       NUMERIC(12, 2) NOT NULL,
  "amenities"       JSONB NOT NULL DEFAULT '[]',
  "sort_order"      INTEGER NOT NULL DEFAULT 0,
  "archived_at"     TIMESTAMPTZ(6),
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hotel_room_types_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hotel_room_types_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "hotel_room_types_code_uq" UNIQUE ("organization_id", "code"),
  CONSTRAINT "hotel_room_types_org_fk" FOREIGN KEY ("organization_id")
    REFERENCES "organizations" ("id") ON DELETE CASCADE,
  CONSTRAINT "hotel_room_types_capacity_check" CHECK ("capacity" BETWEEN 1 AND 12),
  CONSTRAINT "hotel_room_types_base_rate_check" CHECK ("base_rate" > 0),
  CONSTRAINT "hotel_room_types_code_check" CHECK ("code" ~ '^[A-Z0-9]{2,8}$'),
  CONSTRAINT "hotel_room_types_amenities_check" CHECK (jsonb_typeof("amenities") = 'array')
);
CREATE INDEX "hotel_room_types_list_idx" ON "hotel_room_types" ("organization_id", "sort_order", "name");

-- ===========================================================================
-- Rooms. Room state is TWO stored facts (docs/architecture.md §4) — housekeeping and service —
-- and occupancy is derived from reservations. There is deliberately no single `status` column.
-- ===========================================================================
CREATE TABLE "hotel_rooms" (
  "id"                  TEXT NOT NULL,
  "organization_id"     TEXT NOT NULL,
  "number"              TEXT NOT NULL,
  "floor"               INTEGER NOT NULL,
  "room_type_id"        TEXT NOT NULL,
  "housekeeping_status" TEXT NOT NULL DEFAULT 'clean',
  "service_status"      TEXT NOT NULL DEFAULT 'in_service',
  "notes"               TEXT,
  "archived_at"         TIMESTAMPTZ(6),
  "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hotel_rooms_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hotel_rooms_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "hotel_rooms_number_uq" UNIQUE ("organization_id", "number"),
  CONSTRAINT "hotel_rooms_org_fk" FOREIGN KEY ("organization_id")
    REFERENCES "organizations" ("id") ON DELETE CASCADE,
  CONSTRAINT "hotel_rooms_room_type_fk" FOREIGN KEY ("organization_id", "room_type_id")
    REFERENCES "hotel_room_types" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "hotel_rooms_housekeeping_status_check"
    CHECK ("housekeeping_status" IN ('clean', 'dirty', 'cleaning', 'inspected')),
  CONSTRAINT "hotel_rooms_service_status_check"
    CHECK ("service_status" IN ('in_service', 'maintenance', 'out_of_service')),
  CONSTRAINT "hotel_rooms_number_check" CHECK ("number" ~ '^[A-Za-z0-9-]{1,10}$'),
  CONSTRAINT "hotel_rooms_floor_check" CHECK ("floor" BETWEEN -5 AND 200)
);
CREATE INDEX "hotel_rooms_type_idx" ON "hotel_rooms" ("organization_id", "room_type_id");

-- ===========================================================================
-- Guests — the hotel's source of truth for a person. Email unique per hotel when present.
-- ===========================================================================
CREATE TABLE "hotel_guests" (
  "id"                 TEXT NOT NULL,
  "organization_id"    TEXT NOT NULL,
  "full_name"          TEXT NOT NULL,
  "phone"              TEXT,
  "email"              TEXT,
  "nationality"        TEXT,
  "id_document_type"   TEXT,
  "id_document_number" TEXT,
  "preferences"        TEXT,
  "vip"                BOOLEAN NOT NULL DEFAULT false,
  "created_by"         TEXT,
  "created_at"         TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hotel_guests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hotel_guests_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "hotel_guests_org_fk" FOREIGN KEY ("organization_id")
    REFERENCES "organizations" ("id") ON DELETE CASCADE,
  CONSTRAINT "hotel_guests_name_check" CHECK (length(btrim("full_name")) > 1),
  CONSTRAINT "hotel_guests_contact_check" CHECK ("phone" IS NOT NULL OR "email" IS NOT NULL),
  CONSTRAINT "hotel_guests_nationality_check" CHECK ("nationality" IS NULL OR "nationality" ~ '^[A-Z]{2}$'),
  CONSTRAINT "hotel_guests_id_document_check" CHECK (
    ("id_document_type" IS NULL AND "id_document_number" IS NULL)
    OR ("id_document_type" IN ('national_id', 'passport') AND "id_document_number" IS NOT NULL)
  )
);
CREATE UNIQUE INDEX "hotel_guests_email_uq" ON "hotel_guests" ("organization_id", lower("email"))
  WHERE "email" IS NOT NULL;
CREATE INDEX "hotel_guests_name_idx" ON "hotel_guests" ("organization_id", lower("full_name"));
CREATE INDEX "hotel_guests_phone_idx" ON "hotel_guests" ("organization_id", "phone");

CREATE TABLE "hotel_guest_notes" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "guest_id"        TEXT NOT NULL,
  "author_id"       TEXT NOT NULL,
  "body"            TEXT NOT NULL,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hotel_guest_notes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hotel_guest_notes_guest_fk" FOREIGN KEY ("organization_id", "guest_id")
    REFERENCES "hotel_guests" ("organization_id", "id") ON DELETE CASCADE,
  CONSTRAINT "hotel_guest_notes_body_check" CHECK (length(btrim("body")) > 0)
);
CREATE INDEX "hotel_guest_notes_guest_idx" ON "hotel_guest_notes" ("organization_id", "guest_id", "created_at");

-- ===========================================================================
-- updated_at triggers (auric_set_updated_at() from the Core baseline)
-- ===========================================================================
CREATE TRIGGER hotel_settings_set_updated_at BEFORE UPDATE ON "hotel_settings"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER hotel_room_types_set_updated_at BEFORE UPDATE ON "hotel_room_types"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER hotel_rooms_set_updated_at BEFORE UPDATE ON "hotel_rooms"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER hotel_guests_set_updated_at BEFORE UPDATE ON "hotel_guests"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();

-- ===========================================================================
-- Row-level security — tenant_isolation, identical to every other tenant table.
-- ===========================================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['hotel_settings', 'hotel_room_types', 'hotel_rooms', 'hotel_guests', 'hotel_guest_notes']
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
