-- Raqib Phase 5 — approved inspection reports.
--
-- A report is the FROZEN record of an approved inspection: the visit, form version, answers, scores, guard
-- evaluations, evidence metadata and the decision trail exactly as they were when it was approved. It is generated
-- once, inside the approval transaction, and can never change (trigger): later edits to people, projects or forms do
-- not alter an issued report. The PDF is rendered on demand from this snapshot.
CREATE TABLE "raqib_reports" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "visit_id"        TEXT NOT NULL,
  "inspection_id"   TEXT NOT NULL,
  "project_id"      TEXT NOT NULL,
  "ref"             TEXT NOT NULL,
  "score_pct"       INTEGER,
  "snapshot"        JSONB NOT NULL,
  "approved_by"     TEXT,
  "approved_by_name_ar" TEXT NOT NULL,
  "approved_by_name_en" TEXT NOT NULL,
  "generated_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raqib_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "raqib_reports_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "raqib_reports_visit_uq" UNIQUE ("organization_id", "visit_id"),
  CONSTRAINT "raqib_reports_ref_uq" UNIQUE ("organization_id", "ref"),
  CONSTRAINT "raqib_reports_org_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE,
  CONSTRAINT "raqib_reports_visit_fk" FOREIGN KEY ("organization_id", "visit_id")
    REFERENCES "raqib_visits" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "raqib_reports_snapshot_check" CHECK (jsonb_typeof("snapshot") = 'object')
);
CREATE INDEX "raqib_reports_project_idx" ON "raqib_reports" ("organization_id", "project_id", "generated_at" DESC);

CREATE OR REPLACE FUNCTION raqib_reports_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'An issued report is immutable' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER raqib_reports_no_change BEFORE UPDATE OR DELETE ON "raqib_reports"
  FOR EACH ROW EXECUTE FUNCTION raqib_reports_immutable();

ALTER TABLE "raqib_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "raqib_reports" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "raqib_reports"
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));
