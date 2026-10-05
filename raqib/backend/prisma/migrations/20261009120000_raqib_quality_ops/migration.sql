-- Raqib Phase 6a — observations (violations found by inspections, or reported directly) and corrective actions.
--
-- An observation is the finding; a corrective action is the work to fix it. Every non-compliant item of an
-- approved inspection becomes a violation observation (with its repeat count, computed once at creation);
-- ad-hoc observations are reported by people who may add them. A corrective action belongs to exactly one
-- observation and walks assigned -> in_progress -> quality_review -> closed (or returned for more work).
-- The action history (raqib_action_events) is immutable and carries actor snapshots.

CREATE TABLE "raqib_observations" (
  "id"                  TEXT NOT NULL,
  "organization_id"     TEXT NOT NULL,
  "ref"                 TEXT NOT NULL,
  "kind"                TEXT NOT NULL,
  "project_id"          TEXT NOT NULL,
  "site_id"             TEXT NOT NULL,
  "visit_id"            TEXT,
  "inspection_id"       TEXT,
  "item_id"             TEXT,
  "item_key"            TEXT,
  "item_num"            TEXT,
  "title_ar"            TEXT NOT NULL,
  "title_en"            TEXT NOT NULL,
  "note"                TEXT NOT NULL DEFAULT '',
  "severity"            TEXT NOT NULL,
  -- how many earlier findings of the same item at the same site existed when this one was recorded
  "repeat_count"        INTEGER NOT NULL DEFAULT 0,
  "reported_by"         TEXT,
  "reported_by_name_ar" TEXT NOT NULL,
  "reported_by_name_en" TEXT NOT NULL,
  "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raqib_observations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "raqib_observations_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "raqib_observations_ref_uq" UNIQUE ("organization_id", "ref"),
  CONSTRAINT "raqib_observations_org_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE,
  CONSTRAINT "raqib_observations_project_fk" FOREIGN KEY ("organization_id", "project_id")
    REFERENCES "raqib_projects" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "raqib_observations_site_fk" FOREIGN KEY ("organization_id", "site_id")
    REFERENCES "raqib_sites" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "raqib_observations_visit_fk" FOREIGN KEY ("organization_id", "visit_id")
    REFERENCES "raqib_visits" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "raqib_observations_item_fk" FOREIGN KEY ("organization_id", "item_id")
    REFERENCES "raqib_inspection_items" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "raqib_observations_kind_check" CHECK ("kind" IN ('violation', 'observation')),
  CONSTRAINT "raqib_observations_severity_check" CHECK ("severity" IN ('low', 'medium', 'high'))
);
-- one violation per inspection item
CREATE UNIQUE INDEX "raqib_observations_item_uq" ON "raqib_observations" ("organization_id", "item_id") WHERE "item_id" IS NOT NULL;
CREATE INDEX "raqib_observations_project_idx" ON "raqib_observations" ("organization_id", "project_id", "created_at" DESC);
CREATE INDEX "raqib_observations_repeat_idx" ON "raqib_observations" ("organization_id", "site_id", "item_key", "created_at");

CREATE TABLE "raqib_corrective_actions" (
  "id"                  TEXT NOT NULL,
  "organization_id"     TEXT NOT NULL,
  "ref"                 TEXT NOT NULL,
  "observation_id"      TEXT NOT NULL,
  "project_id"          TEXT NOT NULL,
  "title_ar"            TEXT NOT NULL,
  "title_en"            TEXT NOT NULL,
  "description"         TEXT NOT NULL DEFAULT '',
  "priority"            TEXT NOT NULL,
  "responsible_id"      TEXT NOT NULL,
  "due_date"            DATE NOT NULL,
  "status"              TEXT NOT NULL DEFAULT 'assigned',
  "round"               INTEGER NOT NULL DEFAULT 1,
  "created_by"          TEXT,
  "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at"          TIMESTAMPTZ(6),
  "submitted_at"        TIMESTAMPTZ(6),
  "closed_at"           TIMESTAMPTZ(6),
  "overdue_notified_at" TIMESTAMPTZ(6),
  "updated_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raqib_corrective_actions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "raqib_corrective_actions_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "raqib_corrective_actions_ref_uq" UNIQUE ("organization_id", "ref"),
  CONSTRAINT "raqib_corrective_actions_obs_uq" UNIQUE ("organization_id", "observation_id"),
  CONSTRAINT "raqib_corrective_actions_org_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE,
  CONSTRAINT "raqib_corrective_actions_obs_fk" FOREIGN KEY ("organization_id", "observation_id")
    REFERENCES "raqib_observations" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "raqib_corrective_actions_project_fk" FOREIGN KEY ("organization_id", "project_id")
    REFERENCES "raqib_projects" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "raqib_corrective_actions_priority_check" CHECK ("priority" IN ('low', 'medium', 'high')),
  CONSTRAINT "raqib_corrective_actions_status_check" CHECK ("status" IN ('assigned', 'in_progress', 'quality_review', 'returned', 'closed'))
);
CREATE INDEX "raqib_corrective_actions_project_idx" ON "raqib_corrective_actions" ("organization_id", "project_id", "status");
CREATE INDEX "raqib_corrective_actions_resp_idx" ON "raqib_corrective_actions" ("organization_id", "responsible_id", "status");

CREATE TABLE "raqib_action_events" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "action_id"       TEXT NOT NULL,
  "seq"             BIGSERIAL,
  "kind"            TEXT NOT NULL,
  "from_status"     TEXT,
  "to_status"       TEXT,
  "text"            TEXT,
  "actor_id"        TEXT,
  "actor_name_ar"   TEXT NOT NULL,
  "actor_name_en"   TEXT NOT NULL,
  "actor_role"      TEXT,
  "actor_title_ar"  TEXT NOT NULL DEFAULT '',
  "actor_title_en"  TEXT NOT NULL DEFAULT '',
  "at"              TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raqib_action_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "raqib_action_events_action_fk" FOREIGN KEY ("organization_id", "action_id")
    REFERENCES "raqib_corrective_actions" ("organization_id", "id") ON DELETE CASCADE,
  CONSTRAINT "raqib_action_events_kind_check" CHECK ("kind" IN ('created', 'started', 'submitted', 'comment', 'returned', 'closed', 'reassigned'))
);
CREATE INDEX "raqib_action_events_action_idx" ON "raqib_action_events" ("organization_id", "action_id", "seq");

CREATE FUNCTION raqib_action_events_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'raqib_action_events rows are immutable'; END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER raqib_action_events_no_update BEFORE UPDATE ON "raqib_action_events"
  FOR EACH ROW EXECUTE FUNCTION raqib_action_events_immutable();

CREATE TRIGGER raqib_corrective_actions_set_updated_at BEFORE UPDATE ON "raqib_corrective_actions"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['raqib_observations', 'raqib_corrective_actions', 'raqib_action_events']
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
