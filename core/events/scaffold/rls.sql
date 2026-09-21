-- core/events — row-level security (§ docs/tenancy.md).
--
-- outbox / DLQ: the worker uses the system role (BYPASSRLS) to sweep across
-- tenants; the app only ever enqueues, tagged NULL or the active tenant.

ALTER TABLE "outbox_messages"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outbox_messages"      FORCE  ROW LEVEL SECURITY;
ALTER TABLE "dead_letter_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dead_letter_messages" FORCE  ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "outbox_messages"
  USING      (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id IS NULL
              OR organization_id = current_setting('app.organization_id', true));

CREATE POLICY tenant_isolation ON "dead_letter_messages"
  USING      (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id IS NULL
              OR organization_id = current_setting('app.organization_id', true));
