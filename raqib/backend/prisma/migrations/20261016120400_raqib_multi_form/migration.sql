-- Raqib — several forms in one visit, and an issue number for every form inspection (client feedback round 1).
--
--  * raqib_visit_forms        the forms a visit requires, in order (empty = the default site form, as before)
--  * raqib_inspections        one row per (visit, form) instead of one per visit; each has its own issue number
--
-- Existing data is kept: every existing inspection gets its form id from the form version it ran on and the next
-- issue number of its year. Nothing is deleted.

CREATE TABLE "raqib_visit_forms" (
  "organization_id" TEXT NOT NULL,
  "visit_id"        TEXT NOT NULL,
  "form_id"         TEXT NOT NULL,
  "position"        INTEGER NOT NULL,
  CONSTRAINT "raqib_visit_forms_pkey" PRIMARY KEY ("organization_id", "visit_id", "form_id"),
  CONSTRAINT "raqib_visit_forms_position_uq" UNIQUE ("organization_id", "visit_id", "position"),
  CONSTRAINT "raqib_visit_forms_visit_fk" FOREIGN KEY ("organization_id", "visit_id")
    REFERENCES "raqib_visits" ("organization_id", "id") ON DELETE CASCADE,
  CONSTRAINT "raqib_visit_forms_form_fk" FOREIGN KEY ("organization_id", "form_id")
    REFERENCES "raqib_forms" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "raqib_visit_forms_position_check" CHECK ("position" >= 0)
);
ALTER TABLE "raqib_visit_forms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "raqib_visit_forms" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "raqib_visit_forms"
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));

ALTER TABLE "raqib_inspections" ADD COLUMN "form_id" TEXT;
ALTER TABLE "raqib_inspections" ADD COLUMN "issue_no" TEXT;

UPDATE "raqib_inspections" i
   SET "form_id" = fv."form_id"
  FROM "raqib_form_versions" fv
 WHERE fv."organization_id" = i."organization_id" AND fv."id" = i."form_version_id";

WITH numbered AS (
  SELECT id,
         organization_id,
         EXTRACT(YEAR FROM started_at)::int AS yr,
         row_number() OVER (PARTITION BY organization_id, EXTRACT(YEAR FROM started_at) ORDER BY started_at, id) AS rn
    FROM "raqib_inspections"
)
UPDATE "raqib_inspections" i
   SET "issue_no" = 'INS-' || lpad((n.yr % 100)::text, 2, '0') || '-' || lpad(n.rn::text, 4, '0')
  FROM numbered n
 WHERE n.id = i.id;

-- the counter continues after the numbers just handed out
INSERT INTO "raqib_counters" ("organization_id", "kind", "year", "value")
SELECT organization_id, 'INS', EXTRACT(YEAR FROM started_at)::int, count(*)::int
  FROM "raqib_inspections"
 GROUP BY organization_id, EXTRACT(YEAR FROM started_at)
ON CONFLICT ("organization_id", "kind", "year") DO UPDATE SET "value" = EXCLUDED."value";

ALTER TABLE "raqib_inspections" ALTER COLUMN "form_id" SET NOT NULL;
ALTER TABLE "raqib_inspections" ALTER COLUMN "issue_no" SET NOT NULL;
ALTER TABLE "raqib_inspections" ADD CONSTRAINT "raqib_inspections_form_ref_fk"
  FOREIGN KEY ("organization_id", "form_id") REFERENCES "raqib_forms" ("organization_id", "id") ON DELETE RESTRICT;
ALTER TABLE "raqib_inspections" ADD CONSTRAINT "raqib_inspections_issue_uq" UNIQUE ("organization_id", "issue_no");
ALTER TABLE "raqib_inspections" DROP CONSTRAINT "raqib_inspections_visit_uq";
ALTER TABLE "raqib_inspections" ADD CONSTRAINT "raqib_inspections_visit_form_uq" UNIQUE ("organization_id", "visit_id", "form_id");
CREATE INDEX "raqib_inspections_visit_idx" ON "raqib_inspections" ("organization_id", "visit_id", "started_at");
