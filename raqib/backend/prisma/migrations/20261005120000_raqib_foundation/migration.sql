-- Raqib Phase 1 — foundation: settings, permission templates, people profiles, projects, sites,
-- areas, dated project assignments, guards.
--
-- Same shape as the Atlas/HotelOS domain migrations: composite (organization_id, id) unique keys and
-- composite FKs (a child tagged with the wrong tenant is rejected by the FK itself), string-union
-- CHECKs, updated_at triggers, list indexes, FORCE'd tenant_isolation RLS on every table. Hand-written;
-- prisma/schema/raqib-*.prisma mirror these tables for Kysely type generation only.

-- ===========================================================================
-- Settings — exactly one row per organization. The shape is owned by app/raqib/settings.
-- ===========================================================================
CREATE TABLE "raqib_settings" (
  "organization_id" TEXT NOT NULL,
  "data"            JSONB NOT NULL DEFAULT '{}',
  "updated_by"      TEXT,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raqib_settings_pkey" PRIMARY KEY ("organization_id"),
  CONSTRAINT "raqib_settings_org_fk" FOREIGN KEY ("organization_id")
    REFERENCES "organizations" ("id") ON DELETE CASCADE,
  CONSTRAINT "raqib_settings_data_check" CHECK (jsonb_typeof("data") = 'object')
);

-- ===========================================================================
-- Permission templates — per organization, per Raqib role, per module: the letters granted
-- (V view, A add, E edit, S submit, R review, P approve, D download, X export). A row overrides the
-- built-in default for that (role, module); no row = the default. Confidential-report access is NOT
-- expressible here by design (it comes only from explicit grants — see the confidential system).
-- ===========================================================================
CREATE TABLE "raqib_role_templates" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "role_key"        TEXT NOT NULL,
  "module"          TEXT NOT NULL,
  "actions"         TEXT NOT NULL DEFAULT '',
  "updated_by"      TEXT,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raqib_role_templates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "raqib_role_templates_uq" UNIQUE ("organization_id", "role_key", "module"),
  CONSTRAINT "raqib_role_templates_org_fk" FOREIGN KEY ("organization_id")
    REFERENCES "organizations" ("id") ON DELETE CASCADE,
  CONSTRAINT "raqib_role_templates_role_check" CHECK ("role_key" IN ('qm', 'qe', 'pm', 'ins', 'gs', 'guard', 'gm')),
  CONSTRAINT "raqib_role_templates_actions_check" CHECK ("actions" ~ '^[VAESRPDX]*$')
);

-- ===========================================================================
-- People profiles — the Raqib facts about an organization member (names are bilingual master data).
-- `role_key` is the single Raqib role; the Core RBAC role assignment mirrors it for infrastructure
-- permissions (files, audit). `status` is per organization: a disabled person cannot use Raqib even
-- while their Core account exists.
-- ===========================================================================
CREATE TABLE "raqib_profiles" (
  "organization_id" TEXT NOT NULL,
  "user_id"         TEXT NOT NULL,
  "role_key"        TEXT NOT NULL,
  "name_ar"         TEXT NOT NULL,
  "name_en"         TEXT NOT NULL,
  "title_ar"        TEXT NOT NULL DEFAULT '',
  "title_en"        TEXT NOT NULL DEFAULT '',
  "employee_no"     TEXT,
  "phone"           TEXT,
  "status"          TEXT NOT NULL DEFAULT 'active',
  "last_active_at"  TIMESTAMPTZ(6),
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raqib_profiles_pkey" PRIMARY KEY ("organization_id", "user_id"),
  CONSTRAINT "raqib_profiles_org_fk" FOREIGN KEY ("organization_id")
    REFERENCES "organizations" ("id") ON DELETE CASCADE,
  CONSTRAINT "raqib_profiles_user_fk" FOREIGN KEY ("user_id")
    REFERENCES "users" ("id") ON DELETE CASCADE,
  CONSTRAINT "raqib_profiles_role_check" CHECK ("role_key" IN ('qm', 'qe', 'pm', 'ins', 'gs', 'guard', 'gm')),
  CONSTRAINT "raqib_profiles_status_check" CHECK ("status" IN ('active', 'invited', 'disabled'))
);
CREATE INDEX "raqib_profiles_role_idx" ON "raqib_profiles" ("organization_id", "role_key");
CREATE UNIQUE INDEX "raqib_profiles_employee_uq" ON "raqib_profiles" ("organization_id", "employee_no")
  WHERE "employee_no" IS NOT NULL;

-- ===========================================================================
-- Projects → sites → areas
-- ===========================================================================
CREATE TABLE "raqib_projects" (
  "id"               TEXT NOT NULL,
  "organization_id"  TEXT NOT NULL,
  "code"             TEXT NOT NULL,
  "name_ar"          TEXT NOT NULL,
  "name_en"          TEXT NOT NULL,
  "city_ar"          TEXT NOT NULL DEFAULT '',
  "city_en"          TEXT NOT NULL DEFAULT '',
  "region_ar"        TEXT NOT NULL DEFAULT '',
  "region_en"        TEXT NOT NULL DEFAULT '',
  "manager_user_id"  TEXT,
  "status"           TEXT NOT NULL DEFAULT 'active',
  "first_visit_date" DATE,
  "archived_at"      TIMESTAMPTZ(6),
  "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raqib_projects_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "raqib_projects_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "raqib_projects_code_uq" UNIQUE ("organization_id", "code"),
  CONSTRAINT "raqib_projects_org_fk" FOREIGN KEY ("organization_id")
    REFERENCES "organizations" ("id") ON DELETE CASCADE,
  CONSTRAINT "raqib_projects_status_check" CHECK ("status" IN ('active', 'attention', 'mobilizing')),
  CONSTRAINT "raqib_projects_code_check" CHECK ("code" ~ '^[A-Z0-9-]{3,24}$'),
  CONSTRAINT "raqib_projects_name_check" CHECK (length(btrim("name_en")) > 0 AND length(btrim("name_ar")) > 0)
);
CREATE INDEX "raqib_projects_list_idx" ON "raqib_projects" ("organization_id", "status", "code");

CREATE TABLE "raqib_sites" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "project_id"      TEXT NOT NULL,
  "name_ar"         TEXT NOT NULL,
  "name_en"         TEXT NOT NULL,
  "sort_order"      INTEGER NOT NULL DEFAULT 0,
  "archived_at"     TIMESTAMPTZ(6),
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raqib_sites_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "raqib_sites_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "raqib_sites_project_fk" FOREIGN KEY ("organization_id", "project_id")
    REFERENCES "raqib_projects" ("organization_id", "id") ON DELETE CASCADE,
  CONSTRAINT "raqib_sites_name_check" CHECK (length(btrim("name_en")) > 0 AND length(btrim("name_ar")) > 0)
);
CREATE INDEX "raqib_sites_project_idx" ON "raqib_sites" ("organization_id", "project_id", "sort_order");

CREATE TABLE "raqib_areas" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "site_id"         TEXT NOT NULL,
  "name_ar"         TEXT NOT NULL,
  "name_en"         TEXT NOT NULL,
  "sort_order"      INTEGER NOT NULL DEFAULT 0,
  "archived_at"     TIMESTAMPTZ(6),
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raqib_areas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "raqib_areas_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "raqib_areas_site_fk" FOREIGN KEY ("organization_id", "site_id")
    REFERENCES "raqib_sites" ("organization_id", "id") ON DELETE CASCADE,
  CONSTRAINT "raqib_areas_name_check" CHECK (length(btrim("name_en")) > 0 AND length(btrim("name_ar")) > 0)
);
CREATE INDEX "raqib_areas_site_idx" ON "raqib_areas" ("organization_id", "site_id", "sort_order");

-- ===========================================================================
-- Project assignments — dated, never deleted. A person's active scope is the set of rows whose
-- [valid_from, valid_to) contains today; ending an assignment sets valid_to and keeps the history.
-- ===========================================================================
CREATE TABLE "raqib_project_assignments" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "user_id"         TEXT NOT NULL,
  "project_id"      TEXT NOT NULL,
  "valid_from"      DATE NOT NULL,
  "valid_to"        DATE,
  "created_by"      TEXT,
  "ended_by"        TEXT,
  "reason"          TEXT,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raqib_project_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "raqib_project_assignments_project_fk" FOREIGN KEY ("organization_id", "project_id")
    REFERENCES "raqib_projects" ("organization_id", "id") ON DELETE CASCADE,
  CONSTRAINT "raqib_project_assignments_profile_fk" FOREIGN KEY ("organization_id", "user_id")
    REFERENCES "raqib_profiles" ("organization_id", "user_id") ON DELETE CASCADE,
  CONSTRAINT "raqib_project_assignments_range_check" CHECK ("valid_to" IS NULL OR "valid_to" >= "valid_from")
);
-- One open assignment per (person, project).
CREATE UNIQUE INDEX "raqib_project_assignments_open_uq"
  ON "raqib_project_assignments" ("organization_id", "user_id", "project_id") WHERE "valid_to" IS NULL;
CREATE INDEX "raqib_project_assignments_user_idx" ON "raqib_project_assignments" ("organization_id", "user_id");
CREATE INDEX "raqib_project_assignments_project_idx" ON "raqib_project_assignments" ("organization_id", "project_id");

-- ===========================================================================
-- Guards — security officers on a project. Not necessarily users; `user_id` links a guard who
-- signs in (to submit their own confidential reports). The national ID is personal data: the API
-- masks it unless the caller's template says otherwise.
-- ===========================================================================
CREATE TABLE "raqib_guards" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "project_id"      TEXT NOT NULL,
  "user_id"         TEXT,
  "employee_no"     TEXT NOT NULL,
  "national_id"     TEXT NOT NULL,
  "name_ar"         TEXT NOT NULL,
  "name_en"         TEXT NOT NULL,
  "post_ar"         TEXT NOT NULL DEFAULT '',
  "post_en"         TEXT NOT NULL DEFAULT '',
  "shift"           TEXT NOT NULL DEFAULT 'morning',
  "status"          TEXT NOT NULL DEFAULT 'active',
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raqib_guards_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "raqib_guards_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "raqib_guards_employee_uq" UNIQUE ("organization_id", "employee_no"),
  CONSTRAINT "raqib_guards_project_fk" FOREIGN KEY ("organization_id", "project_id")
    REFERENCES "raqib_projects" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "raqib_guards_shift_check" CHECK ("shift" IN ('morning', 'evening', 'night')),
  CONSTRAINT "raqib_guards_status_check" CHECK ("status" IN ('active', 'inactive'))
);
CREATE INDEX "raqib_guards_project_idx" ON "raqib_guards" ("organization_id", "project_id", "status");
CREATE INDEX "raqib_guards_national_id_idx" ON "raqib_guards" ("organization_id", "national_id");
CREATE UNIQUE INDEX "raqib_guards_user_uq" ON "raqib_guards" ("organization_id", "user_id") WHERE "user_id" IS NOT NULL;

-- ===========================================================================
-- updated_at triggers
-- ===========================================================================
CREATE TRIGGER raqib_settings_set_updated_at BEFORE UPDATE ON "raqib_settings"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER raqib_role_templates_set_updated_at BEFORE UPDATE ON "raqib_role_templates"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER raqib_profiles_set_updated_at BEFORE UPDATE ON "raqib_profiles"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER raqib_projects_set_updated_at BEFORE UPDATE ON "raqib_projects"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER raqib_sites_set_updated_at BEFORE UPDATE ON "raqib_sites"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER raqib_areas_set_updated_at BEFORE UPDATE ON "raqib_areas"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER raqib_guards_set_updated_at BEFORE UPDATE ON "raqib_guards"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();

-- ===========================================================================
-- Row-level security — tenant_isolation on every table above.
-- ===========================================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['raqib_settings', 'raqib_role_templates', 'raqib_profiles', 'raqib_projects',
                           'raqib_sites', 'raqib_areas', 'raqib_project_assignments', 'raqib_guards']
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
