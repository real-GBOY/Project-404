-- Raqib Phase 8 — the confidential reporting area.
--
-- Everything here is separate from the operational tables: its own tables, its own access rule, its own log.
--   * No role grants access. Access is an explicit, GM-issued, expiring, revocable grant (raqib_conf_grants).
--   * The reporter's identity is stored apart from the report (raqib_conf_identities) and is only readable by a
--     reveal that needs a reason and is logged. Anonymous reports store no identity at all.
--   * Every entry, view, response, reveal and file open is written to a protected, immutable access log.
--   * Beyond tenant isolation, a RESTRICTIVE row-level-security policy hides these tables unless the transaction
--     has been authorized by the application (app.conf_access = 'on') — a plain query through the application
--     role can read nothing.

CREATE TABLE "raqib_conf_reports" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "ref"             TEXT NOT NULL,
  "kind"            TEXT NOT NULL,
  "sensitivity"     TEXT NOT NULL,
  "subject"         TEXT NOT NULL,
  "body"            TEXT NOT NULL,
  "place"           TEXT NOT NULL DEFAULT '',
  "identity_mode"   TEXT NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'new',
  "response"        TEXT,
  "responded_at"    TIMESTAMPTZ(6),
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raqib_conf_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "raqib_conf_reports_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "raqib_conf_reports_ref_uq" UNIQUE ("organization_id", "ref"),
  CONSTRAINT "raqib_conf_reports_org_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE,
  CONSTRAINT "raqib_conf_reports_kind_check" CHECK ("kind" IN ('misconduct', 'violation', 'safety')),
  CONSTRAINT "raqib_conf_reports_sens_check" CHECK ("sensitivity" IN ('standard', 'high')),
  CONSTRAINT "raqib_conf_reports_mode_check" CHECK ("identity_mode" IN ('named', 'confidential', 'anonymous')),
  CONSTRAINT "raqib_conf_reports_status_check" CHECK ("status" IN ('new', 'under_review', 'closed')),
  CONSTRAINT "raqib_conf_reports_text_check" CHECK (length(btrim("subject")) > 0 AND length(btrim("body")) > 0)
);

-- Who reported it. Absent for anonymous reports. Kept in its own table so that reading a report never reads this.
CREATE TABLE "raqib_conf_identities" (
  "organization_id" TEXT NOT NULL,
  "report_id"       TEXT NOT NULL,
  "user_id"         TEXT NOT NULL,
  "name_ar"         TEXT NOT NULL,
  "name_en"         TEXT NOT NULL,
  "employee_no"     TEXT NOT NULL DEFAULT '',
  CONSTRAINT "raqib_conf_identities_pkey" PRIMARY KEY ("organization_id", "report_id"),
  CONSTRAINT "raqib_conf_identities_report_fk" FOREIGN KEY ("organization_id", "report_id")
    REFERENCES "raqib_conf_reports" ("organization_id", "id") ON DELETE CASCADE
);
CREATE INDEX "raqib_conf_identities_user_idx" ON "raqib_conf_identities" ("organization_id", "user_id");

CREATE TABLE "raqib_conf_files" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "report_id"       TEXT NOT NULL,
  "file_id"         TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "mime"            TEXT NOT NULL,
  "size_bytes"      BIGINT NOT NULL,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raqib_conf_files_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "raqib_conf_files_file_uq" UNIQUE ("organization_id", "file_id"),
  CONSTRAINT "raqib_conf_files_report_fk" FOREIGN KEY ("organization_id", "report_id")
    REFERENCES "raqib_conf_reports" ("organization_id", "id") ON DELETE CASCADE
);

CREATE TABLE "raqib_conf_grants" (
  "id"                 TEXT NOT NULL,
  "organization_id"    TEXT NOT NULL,
  "user_id"            TEXT NOT NULL,
  "level"              TEXT NOT NULL,
  "scope"              TEXT NOT NULL,
  "reason"             TEXT NOT NULL,
  "granted_by"         TEXT,
  "granted_by_name_ar" TEXT NOT NULL,
  "granted_by_name_en" TEXT NOT NULL,
  "granted_at"         TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at"         TIMESTAMPTZ(6) NOT NULL,
  "revoked_at"         TIMESTAMPTZ(6),
  "revoked_by"         TEXT,
  "revoked_by_name_ar" TEXT,
  "revoked_by_name_en" TEXT,
  "revoke_reason"      TEXT,
  CONSTRAINT "raqib_conf_grants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "raqib_conf_grants_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "raqib_conf_grants_org_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE,
  CONSTRAINT "raqib_conf_grants_level_check" CHECK ("level" IN ('view', 'respond')),
  CONSTRAINT "raqib_conf_grants_scope_check" CHECK ("scope" IN ('all', 'standard')),
  CONSTRAINT "raqib_conf_grants_reason_check" CHECK (length(btrim("reason")) >= 3)
);
CREATE INDEX "raqib_conf_grants_user_idx" ON "raqib_conf_grants" ("organization_id", "user_id");

-- The protected access log: append-only.
CREATE TABLE "raqib_conf_access_log" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "seq"             BIGSERIAL,
  "action"          TEXT NOT NULL,
  "actor_id"        TEXT,
  "actor_name_ar"   TEXT NOT NULL,
  "actor_name_en"   TEXT NOT NULL,
  "report_ref"      TEXT,
  "reason"          TEXT,
  "device"          TEXT,
  "at"              TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raqib_conf_access_log_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "raqib_conf_access_log_org_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE,
  CONSTRAINT "raqib_conf_access_log_action_check" CHECK ("action" IN
    ('enter', 'exit', 'view_list', 'view_report', 'respond', 'status', 'reveal_identity', 'open_file', 'grant_issued', 'grant_revoked', 'submit'))
);
CREATE INDEX "raqib_conf_access_log_idx" ON "raqib_conf_access_log" ("organization_id", "actor_id", "action", "at" DESC);

CREATE FUNCTION raqib_conf_access_log_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'raqib_conf_access_log rows are immutable'; END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER raqib_conf_access_log_no_update BEFORE UPDATE ON "raqib_conf_access_log"
  FOR EACH ROW EXECUTE FUNCTION raqib_conf_access_log_immutable();

CREATE TRIGGER raqib_conf_reports_set_updated_at BEFORE UPDATE ON "raqib_conf_reports"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['raqib_conf_reports', 'raqib_conf_identities', 'raqib_conf_files', 'raqib_conf_grants', 'raqib_conf_access_log']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (organization_id = current_setting(''app.organization_id'', true))
         WITH CHECK (organization_id = current_setting(''app.organization_id'', true))',
      t
    );
    -- stricter than tenant isolation: only a transaction the application has authorized may touch these tables
    EXECUTE format(
      'CREATE POLICY conf_authorized ON %I AS RESTRICTIVE
         USING (current_setting(''app.conf_access'', true) = ''on'')
         WITH CHECK (current_setting(''app.conf_access'', true) = ''on'')',
      t
    );
  END LOOP;
END $$;
