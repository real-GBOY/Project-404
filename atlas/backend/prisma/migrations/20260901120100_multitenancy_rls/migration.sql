-- Multi-tenancy, part 2 of 2: row-level security — the backstop (§ docs/tenancy.md).
--
-- A forgotten `WHERE organization_id = …` in Kysely code cannot leak across
-- tenants, because the database refuses to return or write the rows.
--
-- Runtime roles:
--   auric_app     NOBYPASSRLS  — normal request work; every tenant-scoped query
--                                is filtered by the policies below.
--   auric_system  BYPASSRLS    — signup, provider webhooks, the outbox worker.
--
-- CREATE ROLE + the BYPASSRLS attribute require the migration role to be a
-- superuser (or for the roles to be pre-provisioned). In deployments where the
-- migration role is not a superuser, create the two roles by hand first and
-- this block becomes a no-op. Giving the roles LOGIN + a password is a
-- deployment step (scripts/provision-db.ts), kept out of version control.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'auric_app') THEN
    CREATE ROLE "auric_app" NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'auric_system') THEN
    CREATE ROLE "auric_system" NOLOGIN BYPASSRLS;
  END IF;
END $$;

ALTER ROLE "auric_app"    NOBYPASSRLS;
ALTER ROLE "auric_system" BYPASSRLS;

-- ── privileges ────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO "auric_app", "auric_system";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "auric_app", "auric_system";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "auric_app", "auric_system";
-- Future tables created by the migration owner inherit the same grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "auric_app", "auric_system";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO "auric_app", "auric_system";

-- ── enable + FORCE RLS on every tenant-scoped / registry table ─────────────
-- FORCE so the table owner is filtered too — leaks surface in dev/test, not prod.
ALTER TABLE "user_roles"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_roles"           FORCE  ROW LEVEL SECURITY;
ALTER TABLE "files"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "files"                FORCE  ROW LEVEL SECURITY;
ALTER TABLE "audit_logs"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs"           FORCE  ROW LEVEL SECURITY;
ALTER TABLE "notifications"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications"        FORCE  ROW LEVEL SECURITY;
ALTER TABLE "outbox_messages"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outbox_messages"      FORCE  ROW LEVEL SECURITY;
ALTER TABLE "dead_letter_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dead_letter_messages" FORCE  ROW LEVEL SECURITY;
ALTER TABLE "organizations"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizations"        FORCE  ROW LEVEL SECURITY;
ALTER TABLE "organization_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_members" FORCE  ROW LEVEL SECURITY;

-- ── policies ──────────────────────────────────────────────────────────────
-- current_setting(..., true) yields NULL (setting undefined) or '' (set by
-- unitOfWork when the context carries no tenant). Neither equals a real
-- `org_…` id, so the safe default is "see nothing / write nothing".

-- Strictly tenant-scoped: row must match the active tenant, both ways.
CREATE POLICY tenant_isolation ON "user_roles"
  USING      (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));

CREATE POLICY tenant_isolation ON "files"
  USING      (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));

-- audit_logs: the app reads only its active tenant's rows. It may write a
-- NULL-org row for an account-level action (register, login, password reset)
-- that has no tenant; those NULL rows stay invisible to tenant reads and are
-- only queryable via the system role.
CREATE POLICY tenant_isolation ON "audit_logs"
  USING      (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id IS NULL
              OR organization_id = current_setting('app.organization_id', true));

-- notifications: a person's notifications are theirs in any tenant context;
-- a write must be tagged NULL (account-level) or the active tenant.
CREATE POLICY tenant_isolation ON "notifications"
  USING      (user_id = current_setting('app.user_id', true))
  WITH CHECK (organization_id IS NULL
              OR organization_id = current_setting('app.organization_id', true));

-- outbox / DLQ: the worker uses the system role (BYPASSRLS) to sweep across
-- tenants; the app only ever enqueues, tagged NULL or the active tenant.
CREATE POLICY tenant_isolation ON "outbox_messages"
  USING      (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id IS NULL
              OR organization_id = current_setting('app.organization_id', true));

CREATE POLICY tenant_isolation ON "dead_letter_messages"
  USING      (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id IS NULL
              OR organization_id = current_setting('app.organization_id', true));

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
