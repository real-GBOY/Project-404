-- core/files — row-level security (§ docs/tenancy.md).

ALTER TABLE "files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "files" FORCE  ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "files"
  USING      (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));
