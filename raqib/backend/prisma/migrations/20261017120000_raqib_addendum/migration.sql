-- Raqib — client requirements 15–20 (additive).
--
--  R15  projects carry their contract dates and how many employees are assigned
--  R16  a training request knows who asked (supervisor or guard) and may wait for a supervisor first
--  R17  guards answer surveys through the confidential pipeline; a confidential report may name its project
--       (never the reporter) so complaint counts can feed the project indicators of people who hold a grant

ALTER TABLE "raqib_projects" ADD COLUMN "contract_start" DATE;
ALTER TABLE "raqib_projects" ADD COLUMN "contract_end" DATE;
ALTER TABLE "raqib_projects" ADD COLUMN "employees_assigned" INTEGER;
ALTER TABLE "raqib_projects" ADD CONSTRAINT "raqib_projects_contract_check" CHECK ("contract_end" IS NULL OR "contract_start" IS NULL OR "contract_end" >= "contract_start");
ALTER TABLE "raqib_projects" ADD CONSTRAINT "raqib_projects_employees_check" CHECK ("employees_assigned" IS NULL OR "employees_assigned" >= 0);

ALTER TABLE "raqib_training_requests" ADD COLUMN "requester_kind" TEXT NOT NULL DEFAULT 'supervisor';
ALTER TABLE "raqib_training_requests" ADD CONSTRAINT "raqib_training_requests_requester_check" CHECK ("requester_kind" IN ('supervisor', 'guard'));
ALTER TABLE "raqib_training_requests" DROP CONSTRAINT "raqib_training_requests_status_check";
ALTER TABLE "raqib_training_requests" ADD CONSTRAINT "raqib_training_requests_status_check"
  CHECK ("status" IN ('pending_supervisor', 'pending_pm', 'returned', 'rejected', 'approved', 'scheduled', 'completed'));
ALTER TABLE "raqib_training_events" DROP CONSTRAINT "raqib_training_events_kind_check";
ALTER TABLE "raqib_training_events" ADD CONSTRAINT "raqib_training_events_kind_check"
  CHECK ("kind" IN ('requested', 'reviewed', 'returned', 'resubmitted', 'approved', 'rejected', 'scheduled', 'completed'));

ALTER TABLE "raqib_designations" DROP CONSTRAINT "raqib_designations_kind_check";
ALTER TABLE "raqib_designations" ADD CONSTRAINT "raqib_designations_kind_check" CHECK ("kind" IN ('scoring_admin', 'survey_manager'));

-- Survey definitions are not confidential (guards must be able to read the questions); the answers are, and are stored as
-- confidential reports of kind 'survey'.
CREATE TABLE "raqib_surveys" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "title_ar"        TEXT NOT NULL,
  "title_en"        TEXT NOT NULL,
  "intro_ar"        TEXT NOT NULL DEFAULT '',
  "intro_en"        TEXT NOT NULL DEFAULT '',
  -- [{"key":"q1","type":"rating"|"text","text":{"ar":"…","en":"…"}}]
  "questions"       JSONB NOT NULL DEFAULT '[]'::jsonb,
  "status"          TEXT NOT NULL DEFAULT 'draft',
  "created_by"      TEXT,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_at"    TIMESTAMPTZ(6),
  "closed_at"       TIMESTAMPTZ(6),
  CONSTRAINT "raqib_surveys_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "raqib_surveys_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "raqib_surveys_org_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE,
  CONSTRAINT "raqib_surveys_status_check" CHECK ("status" IN ('draft', 'active', 'closed')),
  CONSTRAINT "raqib_surveys_title_check" CHECK (length(btrim("title_en")) > 0 AND length(btrim("title_ar")) > 0)
);
ALTER TABLE "raqib_surveys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "raqib_surveys" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "raqib_surveys"
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));

ALTER TABLE "raqib_conf_reports" ADD COLUMN "survey_id" TEXT;
-- the project a report concerns, when the reporter\'s identity is not anonymous (set from the reporter\'s own roster record)
ALTER TABLE "raqib_conf_reports" ADD COLUMN "project_id" TEXT;
