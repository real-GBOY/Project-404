-- Raqib — deduction scoring (client feedback round 1).
--
-- A project/inspection score starts at the configured base (100) and loses the configured deduction for each
-- recorded non-compliant item. The deduction VALUES are the client's to supply: until a configuration exists the
-- previous weighted-compliance policy keeps scoring, so nothing changes for existing data.
--
--  * raqib_scoring_configs      versioned, append-only rule sets (a new publish is a new version, never an edit)
--  * raqib_inspections.scoring_config_id   the version an inspection was scored under, pinned at start
--  * raqib_inspection_deductions           one row per (inspection, item): a recorded violation can only deduct once
--  * raqib_designations         who may publish a scoring configuration (named by the General Manager)

CREATE TABLE "raqib_scoring_configs" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "version"         INTEGER NOT NULL,
  "base_score"      INTEGER NOT NULL DEFAULT 100,
  -- {"low": n, "medium": n, "high": n}: points deducted per non-compliant item of that severity
  "by_severity"     JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- {"<item key>": n}: an item-specific deduction overrides the severity one
  "by_item"         JSONB NOT NULL DEFAULT '{}'::jsonb,
  "reason"          TEXT NOT NULL,
  "created_by"      TEXT,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raqib_scoring_configs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "raqib_scoring_configs_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "raqib_scoring_configs_version_uq" UNIQUE ("organization_id", "version"),
  CONSTRAINT "raqib_scoring_configs_org_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE,
  CONSTRAINT "raqib_scoring_configs_base_check" CHECK ("base_score" BETWEEN 1 AND 100),
  CONSTRAINT "raqib_scoring_configs_version_check" CHECK ("version" >= 1)
);

CREATE FUNCTION raqib_scoring_configs_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'raqib_scoring_configs rows are immutable: publish a new version instead';
END $$;
CREATE TRIGGER raqib_scoring_configs_no_change BEFORE UPDATE OR DELETE ON "raqib_scoring_configs"
  FOR EACH ROW EXECUTE FUNCTION raqib_scoring_configs_immutable();

ALTER TABLE "raqib_inspections" ADD COLUMN "scoring_config_id" TEXT;
ALTER TABLE "raqib_inspections" ADD CONSTRAINT "raqib_inspections_scoring_config_fk"
  FOREIGN KEY ("organization_id", "scoring_config_id") REFERENCES "raqib_scoring_configs" ("organization_id", "id") ON DELETE RESTRICT;

CREATE TABLE "raqib_inspection_deductions" (
  "organization_id" TEXT NOT NULL,
  "inspection_id"   TEXT NOT NULL,
  "item_id"         TEXT NOT NULL,
  "item_key"        TEXT NOT NULL,
  "severity"        TEXT,
  "amount"          INTEGER NOT NULL,
  "config_id"       TEXT NOT NULL,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- the primary key is the "no duplicate deduction" rule: one recorded violation, one deduction
  CONSTRAINT "raqib_inspection_deductions_pkey" PRIMARY KEY ("organization_id", "inspection_id", "item_id"),
  CONSTRAINT "raqib_inspection_deductions_insp_fk" FOREIGN KEY ("organization_id", "inspection_id")
    REFERENCES "raqib_inspections" ("organization_id", "id") ON DELETE CASCADE,
  CONSTRAINT "raqib_inspection_deductions_item_fk" FOREIGN KEY ("organization_id", "item_id")
    REFERENCES "raqib_inspection_items" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "raqib_inspection_deductions_config_fk" FOREIGN KEY ("organization_id", "config_id")
    REFERENCES "raqib_scoring_configs" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "raqib_inspection_deductions_amount_check" CHECK ("amount" >= 0),
  CONSTRAINT "raqib_inspection_deductions_severity_check" CHECK ("severity" IS NULL OR "severity" IN ('low', 'medium', 'high'))
);

CREATE TABLE "raqib_designations" (
  "organization_id" TEXT NOT NULL,
  "user_id"         TEXT NOT NULL,
  "kind"            TEXT NOT NULL,
  "granted_by"      TEXT,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raqib_designations_pkey" PRIMARY KEY ("organization_id", "user_id", "kind"),
  CONSTRAINT "raqib_designations_org_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE,
  CONSTRAINT "raqib_designations_kind_check" CHECK ("kind" IN ('scoring_admin'))
);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['raqib_scoring_configs', 'raqib_inspection_deductions', 'raqib_designations']
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
