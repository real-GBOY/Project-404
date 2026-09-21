-- core/organizations — row-level security (§ docs/tenancy.md).

ALTER TABLE "organizations"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizations"        FORCE  ROW LEVEL SECURITY;
ALTER TABLE "organization_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_members" FORCE  ROW LEVEL SECURITY;

-- organizations: visible if you are a member. Creation/rename run system-context.
CREATE POLICY member_visibility ON "organizations"
  USING (id IN (
    SELECT organization_id FROM "organization_members"
    WHERE user_id = current_setting('app.user_id', true)
  ));

-- organization_members: your own memberships (needed at login, before a tenant
-- is chosen), or any member of the active tenant.
CREATE POLICY member_visibility ON "organization_members"
  USING      (user_id = current_setting('app.user_id', true)
              OR organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));
