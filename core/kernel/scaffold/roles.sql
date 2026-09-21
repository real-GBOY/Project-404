-- Multi-tenancy runtime roles + privileges (§ docs/tenancy.md). Runs at the start
-- of the security migration, after every table exists.
--
-- Runtime roles:
--   auric_app     NOBYPASSRLS  — normal request work; every tenant-scoped query
--                                is filtered by the policies in the modules' RLS.
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
