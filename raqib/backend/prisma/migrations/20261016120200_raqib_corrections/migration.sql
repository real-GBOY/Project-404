-- Raqib — authorised corrections of system-generated data (client feedback round 1).
--
-- Inspectors can never change timestamps, issue numbers, deductions or results: the API has no route for it. When a
-- correction is genuinely needed (e.g. a wrong device clock) an authorised person makes it through the corrections
-- route only, which writes one row here with the previous value, the new value, who, in which role, when and why.
-- Rows are append-only (no UPDATE, no DELETE), so the original history is always preserved.

CREATE TABLE "raqib_corrections" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "seq"             BIGSERIAL,
  "inspection_id"   TEXT NOT NULL,
  "visit_id"        TEXT NOT NULL,
  "project_id"      TEXT NOT NULL,
  "field"           TEXT NOT NULL,
  "item_key"        TEXT,
  "previous_value"  TEXT,
  "new_value"       TEXT NOT NULL,
  "reason"          TEXT NOT NULL,
  "actor_id"        TEXT,
  "actor_name_ar"   TEXT NOT NULL,
  "actor_name_en"   TEXT NOT NULL,
  "actor_role"      TEXT,
  "at"              TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raqib_corrections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "raqib_corrections_org_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE,
  CONSTRAINT "raqib_corrections_inspection_fk" FOREIGN KEY ("organization_id", "inspection_id")
    REFERENCES "raqib_inspections" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "raqib_corrections_field_check" CHECK ("field" IN ('started_at', 'submitted_at', 'deduction_amount')),
  CONSTRAINT "raqib_corrections_reason_check" CHECK (length(btrim("reason")) >= 3)
);
CREATE INDEX "raqib_corrections_inspection_idx" ON "raqib_corrections" ("organization_id", "inspection_id", "seq");

CREATE FUNCTION raqib_corrections_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'raqib_corrections rows are immutable';
END $$;
CREATE TRIGGER raqib_corrections_no_change BEFORE UPDATE OR DELETE ON "raqib_corrections"
  FOR EACH ROW EXECUTE FUNCTION raqib_corrections_immutable();

ALTER TABLE "raqib_corrections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "raqib_corrections" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "raqib_corrections"
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));
