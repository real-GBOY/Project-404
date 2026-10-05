-- Raqib Phase 6b — training requests.
--
-- A guards supervisor requests training for a guard; the project manager approves, returns or rejects; quality
-- schedules approved training and records its completion, which becomes part of the guard's training record.
-- The history (raqib_training_events) is immutable and carries actor snapshots.

CREATE TABLE "raqib_training_requests" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "ref"             TEXT NOT NULL,
  "guard_id"        TEXT NOT NULL,
  "project_id"      TEXT NOT NULL,
  "reason"          TEXT NOT NULL,
  "course"          TEXT NOT NULL,
  "related"         TEXT NOT NULL DEFAULT '',
  "priority"        TEXT NOT NULL,
  "notes"           TEXT NOT NULL DEFAULT '',
  "status"          TEXT NOT NULL DEFAULT 'pending_pm',
  "round"           INTEGER NOT NULL DEFAULT 1,
  "requested_by"    TEXT,
  "scheduled_date"  DATE,
  "provider"        TEXT,
  "completed_date"  DATE,
  "result"          TEXT,
  "result_note"     TEXT,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raqib_training_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "raqib_training_requests_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "raqib_training_requests_ref_uq" UNIQUE ("organization_id", "ref"),
  CONSTRAINT "raqib_training_requests_org_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE,
  CONSTRAINT "raqib_training_requests_guard_fk" FOREIGN KEY ("organization_id", "guard_id")
    REFERENCES "raqib_guards" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "raqib_training_requests_project_fk" FOREIGN KEY ("organization_id", "project_id")
    REFERENCES "raqib_projects" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "raqib_training_requests_reason_check" CHECK ("reason" IN ('low_score', 'repeat_issue', 'incident', 'refresher', 'new_assignment')),
  CONSTRAINT "raqib_training_requests_priority_check" CHECK ("priority" IN ('low', 'medium', 'high')),
  CONSTRAINT "raqib_training_requests_status_check" CHECK ("status" IN ('pending_pm', 'returned', 'rejected', 'approved', 'scheduled', 'completed')),
  CONSTRAINT "raqib_training_requests_result_check" CHECK ("result" IS NULL OR "result" IN ('passed', 'attended', 'failed')),
  CONSTRAINT "raqib_training_requests_course_check" CHECK (length(btrim("course")) > 0)
);
CREATE INDEX "raqib_training_requests_project_idx" ON "raqib_training_requests" ("organization_id", "project_id", "status");
CREATE INDEX "raqib_training_requests_guard_idx" ON "raqib_training_requests" ("organization_id", "guard_id");

CREATE TABLE "raqib_training_events" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "request_id"      TEXT NOT NULL,
  "seq"             BIGSERIAL,
  "kind"            TEXT NOT NULL,
  "from_status"     TEXT,
  "to_status"       TEXT NOT NULL,
  "text"            TEXT,
  "actor_id"        TEXT,
  "actor_name_ar"   TEXT NOT NULL,
  "actor_name_en"   TEXT NOT NULL,
  "actor_role"      TEXT,
  "actor_title_ar"  TEXT NOT NULL DEFAULT '',
  "actor_title_en"  TEXT NOT NULL DEFAULT '',
  "at"              TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raqib_training_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "raqib_training_events_request_fk" FOREIGN KEY ("organization_id", "request_id")
    REFERENCES "raqib_training_requests" ("organization_id", "id") ON DELETE CASCADE,
  CONSTRAINT "raqib_training_events_kind_check" CHECK ("kind" IN ('requested', 'returned', 'resubmitted', 'approved', 'rejected', 'scheduled', 'completed'))
);
CREATE INDEX "raqib_training_events_request_idx" ON "raqib_training_events" ("organization_id", "request_id", "seq");

CREATE FUNCTION raqib_training_events_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'raqib_training_events rows are immutable'; END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER raqib_training_events_no_update BEFORE UPDATE ON "raqib_training_events"
  FOR EACH ROW EXECUTE FUNCTION raqib_training_events_immutable();

CREATE TRIGGER raqib_training_requests_set_updated_at BEFORE UPDATE ON "raqib_training_requests"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['raqib_training_requests', 'raqib_training_events']
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
