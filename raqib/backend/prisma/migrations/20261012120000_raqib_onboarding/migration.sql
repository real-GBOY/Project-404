-- Raqib — account onboarding.
--
-- A person asks for an account through a public form (declaration + typed e-signature). The Director of Quality
-- reviews the request, then approves it with a role and projects (which creates the account and sends a secure
-- password-setup link) or rejects it with a reason. The signed declaration is stored as submitted and never edited.

CREATE TABLE "raqib_account_requests" (
  "id"                 TEXT NOT NULL,
  "organization_id"    TEXT NOT NULL,
  "ref"                TEXT NOT NULL,
  "name"               TEXT NOT NULL,
  "email"              TEXT NOT NULL,
  "phone"              TEXT NOT NULL,
  "national_id"        TEXT NOT NULL,
  "employee_no"        TEXT NOT NULL DEFAULT '',
  "department"         TEXT NOT NULL DEFAULT '',
  "requested_role"     TEXT NOT NULL,
  "requested_projects" TEXT NOT NULL DEFAULT '',
  "justification"      TEXT NOT NULL,
  "declaration_version" TEXT NOT NULL,
  "signed_name"        TEXT NOT NULL,
  "signed_at"          TIMESTAMPTZ(6) NOT NULL,
  "status"             TEXT NOT NULL DEFAULT 'pending',
  "decided_by"         TEXT,
  "decided_by_name_ar" TEXT,
  "decided_by_name_en" TEXT,
  "decided_at"         TIMESTAMPTZ(6),
  "decision_reason"    TEXT,
  "assigned_role"      TEXT,
  "assigned_project_ids" JSONB,
  "user_id"            TEXT,
  "created_at"         TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raqib_account_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "raqib_account_requests_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "raqib_account_requests_ref_uq" UNIQUE ("organization_id", "ref"),
  CONSTRAINT "raqib_account_requests_org_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE,
  CONSTRAINT "raqib_account_requests_status_check" CHECK ("status" IN ('pending', 'approved', 'rejected')),
  CONSTRAINT "raqib_account_requests_role_check" CHECK ("requested_role" IN ('qe', 'pm', 'ins', 'gs', 'guard')),
  CONSTRAINT "raqib_account_requests_decision_check" CHECK ("status" = 'pending' OR "decided_at" IS NOT NULL)
);
-- one open request per email address
CREATE UNIQUE INDEX "raqib_account_requests_pending_uq" ON "raqib_account_requests" ("organization_id", lower("email")) WHERE "status" = 'pending';

ALTER TABLE "raqib_account_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "raqib_account_requests" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "raqib_account_requests"
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));
