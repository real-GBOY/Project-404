-- core/audit — row-level security (§ docs/tenancy.md).

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE  ROW LEVEL SECURITY;

-- audit_logs: the app reads only its active tenant's rows. It may write a
-- NULL-org row for an account-level action (register, login, password reset)
-- that has no tenant; those NULL rows stay invisible to tenant reads and are
-- only queryable via the system role.
CREATE POLICY tenant_isolation ON "audit_logs"
  USING      (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id IS NULL
              OR organization_id = current_setting('app.organization_id', true));
