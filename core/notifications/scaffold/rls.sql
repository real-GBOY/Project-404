-- core/notifications — row-level security (§ docs/tenancy.md).
--
-- `notification_templates` is a global registry; only `notifications` is scoped.

ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" FORCE  ROW LEVEL SECURITY;

-- notifications: a person's notifications are theirs in any tenant context;
-- a write must be tagged NULL (account-level) or the active tenant.
CREATE POLICY tenant_isolation ON "notifications"
  USING      (user_id = current_setting('app.user_id', true))
  WITH CHECK (organization_id IS NULL
              OR organization_id = current_setting('app.organization_id', true));
