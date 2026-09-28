-- HotelOS Slice 8 — the public booking API.

-- ===========================================================================
-- Idempotency for bookings made from the public website: a retried request with the same key
-- returns the original booking instead of making a second one.
CREATE TABLE "hotel_public_bookings" (
  "organization_id" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "request_hash"    TEXT NOT NULL,
  "reservation_id"  TEXT NOT NULL,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hotel_public_bookings_pkey" PRIMARY KEY ("organization_id", "idempotency_key"),
  CONSTRAINT "hotel_public_bookings_reservation_fk" FOREIGN KEY ("organization_id", "reservation_id")
    REFERENCES "hotel_reservations" ("organization_id", "id") ON DELETE CASCADE
);

DO $$
BEGIN
  ALTER TABLE "hotel_public_bookings" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "hotel_public_bookings" FORCE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON "hotel_public_bookings"
    USING (organization_id = current_setting('app.organization_id', true))
    WITH CHECK (organization_id = current_setting('app.organization_id', true));
END $$;

-- ===========================================================================
-- Fixed-window rate-limit counters for anonymous endpoints, shared by every API instance.
-- Global (not tenant data) and only touched on the system connection; old windows are pruned
-- by the scheduled jobs.
CREATE TABLE "hotel_rate_limits" (
  "bucket"       TEXT NOT NULL,
  "window_start" TIMESTAMPTZ(6) NOT NULL,
  "hits"         INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "hotel_rate_limits_pkey" PRIMARY KEY ("bucket", "window_start")
);
CREATE INDEX "hotel_rate_limits_window_idx" ON "hotel_rate_limits" ("window_start");
