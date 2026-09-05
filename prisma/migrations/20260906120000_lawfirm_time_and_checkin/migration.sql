-- Mizan law-firm domain — additive migration.
--
--   1. lawfirm_time_entries — billable/non-billable time logged against a
--      matter (mobile Log Time screen + Finance "unbilled time" roll-up).
--   2. lawfirm_hearings.checked_in_at — "checked in at court" timestamp
--      (mobile Hearing screen).
--
-- Same conventions as 20260902120000_lawfirm: composite (organization_id, id)
-- unique key, composite FK to the parent, string-union CHECK constraints, an
-- updated_at trigger, list indexes, and tenant_isolation RLS.

-- ===========================================================================
-- 1. Time entries
-- ===========================================================================
CREATE TABLE "lawfirm_time_entries" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "matter_id"       TEXT NOT NULL,
  "user_id"         TEXT NOT NULL,
  "activity"        TEXT NOT NULL,
  "narrative"       TEXT,
  "minutes"         INTEGER NOT NULL,
  "billable"        BOOLEAN NOT NULL DEFAULT true,
  "hourly_rate"     DECIMAL(14, 2),
  "currency"        TEXT NOT NULL DEFAULT 'EGP',
  "status"          TEXT NOT NULL DEFAULT 'unbilled',
  "logged_at"       TIMESTAMPTZ(6) NOT NULL,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lawfirm_time_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lawfirm_time_entries_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "lawfirm_time_entries_minutes_check" CHECK ("minutes" > 0),
  CONSTRAINT "lawfirm_time_entries_currency_check" CHECK ("currency" IN ('EGP', 'AED', 'USD', 'SAR')),
  CONSTRAINT "lawfirm_time_entries_status_check" CHECK ("status" IN ('unbilled', 'billed')),
  CONSTRAINT "lawfirm_time_entries_matter_fk" FOREIGN KEY ("organization_id", "matter_id")
    REFERENCES "lawfirm_matters" ("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX "lawfirm_time_entries_org_idx" ON "lawfirm_time_entries" ("organization_id");
CREATE INDEX "lawfirm_time_entries_matter_idx" ON "lawfirm_time_entries" ("organization_id", "matter_id");
CREATE INDEX "lawfirm_time_entries_user_idx" ON "lawfirm_time_entries" ("organization_id", "user_id");
CREATE INDEX "lawfirm_time_entries_status_idx" ON "lawfirm_time_entries" ("organization_id", "status");

CREATE TRIGGER lawfirm_time_entries_set_updated_at BEFORE UPDATE ON "lawfirm_time_entries"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();

ALTER TABLE "lawfirm_time_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lawfirm_time_entries" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "lawfirm_time_entries"
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));

-- ===========================================================================
-- 2. Hearing check-in
-- ===========================================================================
ALTER TABLE "lawfirm_hearings" ADD COLUMN "checked_in_at" TIMESTAMPTZ(6);
