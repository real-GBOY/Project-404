-- core/rbac — row-level security (§ docs/tenancy.md).
--
-- `roles`, `permissions` and `role_permissions` are global registries; only the
-- per-tenant role assignments are tenant-scoped.

ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_roles" FORCE  ROW LEVEL SECURITY;

-- Strictly tenant-scoped: row must match the active tenant, both ways.
CREATE POLICY tenant_isolation ON "user_roles"
  USING      (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));
