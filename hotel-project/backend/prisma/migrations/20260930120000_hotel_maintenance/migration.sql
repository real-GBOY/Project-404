-- HotelOS Slice 4 — maintenance tickets, their timeline, and room blocks.
--
-- A ticket may take its room out of sale ("room impact"). The block is a claim in the SAME
-- allocation ledger as reservations (kind = 'block'), so the existing exclusion constraint makes it
-- impossible to block a room over a booked stay, or to book a room over a block. The room returns
-- to service only when the ticket is verified — never merely because a stay ended.

CREATE TABLE "hotel_maintenance_tickets" (
  "id"               TEXT NOT NULL,
  "organization_id"  TEXT NOT NULL,
  "number"           TEXT NOT NULL,
  "room_id"          TEXT NOT NULL,
  "title"            TEXT NOT NULL,
  "description"      TEXT,
  "priority"         TEXT NOT NULL DEFAULT 'medium',
  "status"           TEXT NOT NULL DEFAULT 'open',
  "assignee_id"      TEXT,
  "cost"             NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "room_impact"      TEXT NOT NULL DEFAULT 'none',
  "expected_back"    DATE,
  "resolution_notes" TEXT,
  "reported_by"      TEXT,
  "resolved_at"      TIMESTAMPTZ(6),
  "verified_at"      TIMESTAMPTZ(6),
  "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hotel_maintenance_tickets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hotel_maintenance_tickets_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "hotel_maintenance_tickets_number_uq" UNIQUE ("organization_id", "number"),
  CONSTRAINT "hotel_maintenance_tickets_room_fk" FOREIGN KEY ("organization_id", "room_id")
    REFERENCES "hotel_rooms" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "hotel_maintenance_tickets_priority_check" CHECK ("priority" IN ('low', 'medium', 'high', 'urgent')),
  CONSTRAINT "hotel_maintenance_tickets_status_check" CHECK (
    "status" IN ('open', 'assigned', 'in_progress', 'resolved', 'verified')
  ),
  CONSTRAINT "hotel_maintenance_tickets_impact_check" CHECK ("room_impact" IN ('none', 'maintenance', 'out_of_service')),
  CONSTRAINT "hotel_maintenance_tickets_expected_back_check" CHECK (
    ("room_impact" = 'none') = ("expected_back" IS NULL)
  ),
  CONSTRAINT "hotel_maintenance_tickets_cost_check" CHECK ("cost" >= 0),
  CONSTRAINT "hotel_maintenance_tickets_assignee_check" CHECK ("status" = 'open' OR "assignee_id" IS NOT NULL),
  CONSTRAINT "hotel_maintenance_tickets_title_check" CHECK (length(btrim("title")) > 2)
);
CREATE INDEX "hotel_maintenance_tickets_status_idx"
  ON "hotel_maintenance_tickets" ("organization_id", "status", "priority");
CREATE INDEX "hotel_maintenance_tickets_room_idx"
  ON "hotel_maintenance_tickets" ("organization_id", "room_id");

CREATE TABLE "hotel_maintenance_events" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "ticket_id"       TEXT NOT NULL,
  "seq"             BIGSERIAL NOT NULL,
  "kind"            TEXT NOT NULL,
  "body"            TEXT,
  "actor_id"        TEXT,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hotel_maintenance_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hotel_maintenance_events_ticket_fk" FOREIGN KEY ("organization_id", "ticket_id")
    REFERENCES "hotel_maintenance_tickets" ("organization_id", "id") ON DELETE CASCADE,
  CONSTRAINT "hotel_maintenance_events_kind_check" CHECK (
    "kind" IN ('reported', 'assigned', 'started', 'note', 'cost', 'resolved', 'reopened', 'verified', 'block_extended')
  )
);
CREATE INDEX "hotel_maintenance_events_ticket_idx"
  ON "hotel_maintenance_events" ("organization_id", "ticket_id", "seq");

-- Blocks now belong to a ticket: every claim in the ledger has exactly one owner.
ALTER TABLE "hotel_room_allocations" ADD COLUMN "ticket_id" TEXT;
ALTER TABLE "hotel_room_allocations" ADD CONSTRAINT "hotel_room_allocations_ticket_fk"
  FOREIGN KEY ("organization_id", "ticket_id")
  REFERENCES "hotel_maintenance_tickets" ("organization_id", "id") ON DELETE RESTRICT;
ALTER TABLE "hotel_room_allocations" DROP CONSTRAINT "hotel_room_allocations_kind_ref_check";
ALTER TABLE "hotel_room_allocations" ADD CONSTRAINT "hotel_room_allocations_kind_ref_check" CHECK (
  ("kind" = 'reservation' AND "reservation_id" IS NOT NULL AND "ticket_id" IS NULL)
  OR ("kind" = 'block' AND "ticket_id" IS NOT NULL AND "reservation_id" IS NULL)
);
CREATE INDEX "hotel_room_allocations_ticket_idx" ON "hotel_room_allocations" ("organization_id", "ticket_id");

CREATE TRIGGER hotel_maintenance_tickets_set_updated_at BEFORE UPDATE ON "hotel_maintenance_tickets"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['hotel_maintenance_tickets', 'hotel_maintenance_events']
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
