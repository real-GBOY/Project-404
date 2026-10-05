-- Raqib Phase 2 — visits: reference counters, visits, guards on shift, the immutable visit event history.
--
-- A visit is the unit of field work: where (project → site → area), who (inspector), when, and its
-- lifecycle status. "Overdue" is NOT stored — it is derived from the schedule and the organization's
-- overdue window. Every state change appends a visit event carrying snapshots of the actor's name,
-- role and title, so history never changes when people or roles change later.

-- ===========================================================================
-- Reference counters — VIS-26-0418, CA-26-0118 … one atomic counter per (kind, year) per organization.
-- ===========================================================================
CREATE TABLE "raqib_counters" (
  "organization_id" TEXT NOT NULL,
  "kind"            TEXT NOT NULL,
  "year"            INTEGER NOT NULL,
  "value"           INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "raqib_counters_pkey" PRIMARY KEY ("organization_id", "kind", "year"),
  CONSTRAINT "raqib_counters_org_fk" FOREIGN KEY ("organization_id")
    REFERENCES "organizations" ("id") ON DELETE CASCADE
);

-- ===========================================================================
-- Visits
-- ===========================================================================
CREATE TABLE "raqib_visits" (
  "id"                TEXT NOT NULL,
  "organization_id"   TEXT NOT NULL,
  "ref"               TEXT NOT NULL,
  "project_id"        TEXT NOT NULL,
  "site_id"           TEXT NOT NULL,
  "area_id"           TEXT,
  "area_text"         TEXT,
  "inspector_id"      TEXT,
  "visit_type"        TEXT NOT NULL DEFAULT 'routine',
  "shift"             TEXT NOT NULL DEFAULT 'morning',
  "scheduled_date"    DATE NOT NULL,
  "scheduled_time"    TEXT NOT NULL,
  "status"            TEXT NOT NULL DEFAULT 'scheduled',
  "round"             INTEGER NOT NULL DEFAULT 1,
  "overdue_notified_at" TIMESTAMPTZ(6),
  "created_by"        TEXT,
  "created_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raqib_visits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "raqib_visits_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "raqib_visits_ref_uq" UNIQUE ("organization_id", "ref"),
  CONSTRAINT "raqib_visits_project_fk" FOREIGN KEY ("organization_id", "project_id")
    REFERENCES "raqib_projects" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "raqib_visits_site_fk" FOREIGN KEY ("organization_id", "site_id")
    REFERENCES "raqib_sites" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "raqib_visits_area_fk" FOREIGN KEY ("organization_id", "area_id")
    REFERENCES "raqib_areas" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "raqib_visits_status_check" CHECK ("status" IN
    ('scheduled', 'assigned', 'in_progress', 'pending_review', 'pending_approval', 'returned', 'approved', 'rejected', 'cancelled')),
  CONSTRAINT "raqib_visits_type_check" CHECK ("visit_type" IN ('routine', 'surprise', 'follow', 'night')),
  CONSTRAINT "raqib_visits_shift_check" CHECK ("shift" IN ('morning', 'evening', 'night')),
  CONSTRAINT "raqib_visits_time_check" CHECK ("scheduled_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  -- an unassigned visit is 'scheduled'; once an inspector is named it moves on; every later status has one
  CONSTRAINT "raqib_visits_inspector_check" CHECK (
    ("status" = 'scheduled') OR ("status" = 'cancelled') OR ("inspector_id" IS NOT NULL)
  )
);
CREATE INDEX "raqib_visits_project_idx" ON "raqib_visits" ("organization_id", "project_id", "scheduled_date");
CREATE INDEX "raqib_visits_inspector_idx" ON "raqib_visits" ("organization_id", "inspector_id", "scheduled_date");
CREATE INDEX "raqib_visits_status_idx" ON "raqib_visits" ("organization_id", "status", "scheduled_date");
-- An inspector cannot hold two live visits at the same date and time.
CREATE UNIQUE INDEX "raqib_visits_inspector_slot_uq"
  ON "raqib_visits" ("organization_id", "inspector_id", "scheduled_date", "scheduled_time")
  WHERE "inspector_id" IS NOT NULL AND "status" IN ('scheduled', 'assigned', 'in_progress', 'returned');

-- Guards on shift for the visit (evaluated during the inspection).
CREATE TABLE "raqib_visit_guards" (
  "organization_id" TEXT NOT NULL,
  "visit_id"        TEXT NOT NULL,
  "guard_id"        TEXT NOT NULL,
  CONSTRAINT "raqib_visit_guards_pkey" PRIMARY KEY ("organization_id", "visit_id", "guard_id"),
  CONSTRAINT "raqib_visit_guards_visit_fk" FOREIGN KEY ("organization_id", "visit_id")
    REFERENCES "raqib_visits" ("organization_id", "id") ON DELETE CASCADE,
  CONSTRAINT "raqib_visit_guards_guard_fk" FOREIGN KEY ("organization_id", "guard_id")
    REFERENCES "raqib_guards" ("organization_id", "id") ON DELETE RESTRICT
);

-- ===========================================================================
-- Visit events — append-only history with actor snapshots. `seq` orders events written in one
-- transaction (they share CURRENT_TIMESTAMP).
-- ===========================================================================
CREATE TABLE "raqib_visit_events" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "visit_id"        TEXT NOT NULL,
  "seq"             BIGSERIAL,
  "action"          TEXT NOT NULL,
  "from_status"     TEXT,
  "to_status"       TEXT NOT NULL,
  "actor_id"        TEXT,
  "actor_name_ar"   TEXT NOT NULL,
  "actor_name_en"   TEXT NOT NULL,
  "actor_role"      TEXT,
  "actor_title_ar"  TEXT NOT NULL DEFAULT '',
  "actor_title_en"  TEXT NOT NULL DEFAULT '',
  "reason"          TEXT,
  "detail"          JSONB,
  "at"              TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raqib_visit_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "raqib_visit_events_visit_fk" FOREIGN KEY ("organization_id", "visit_id")
    REFERENCES "raqib_visits" ("organization_id", "id") ON DELETE CASCADE,
  CONSTRAINT "raqib_visit_events_action_check" CHECK ("action" IN
    ('scheduled', 'assigned', 'started', 'submitted', 'resubmitted', 'reviewed', 'returned', 'rejected', 'approved', 'rescheduled', 'cancelled'))
);
CREATE INDEX "raqib_visit_events_visit_idx" ON "raqib_visit_events" ("organization_id", "visit_id", "seq");

-- History is immutable: no UPDATE, no DELETE of visit events (cascade from a deleted visit aside, which never happens).
CREATE FUNCTION raqib_visit_events_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'raqib_visit_events rows are immutable'; END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER raqib_visit_events_no_update BEFORE UPDATE ON "raqib_visit_events"
  FOR EACH ROW EXECUTE FUNCTION raqib_visit_events_immutable();

CREATE TRIGGER raqib_visits_set_updated_at BEFORE UPDATE ON "raqib_visits"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['raqib_counters', 'raqib_visits', 'raqib_visit_guards', 'raqib_visit_events']
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
