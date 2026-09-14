-- Multi-tenancy, part 1 of 2: the `organization_id` columns (§ docs/tenancy.md).
-- Part 2 (`..._rls`) adds the row-level-security policies and the app/system
-- database roles. Hand-written (not `prisma migrate dev`) so the two columns
-- that become NOT NULL can be backfilled on a database that already has rows.

-- ── nullable tenant columns ────────────────────────────────────────────────
-- audit_logs / notifications / outbox / DLQ: NULL means "no single tenant"
-- (system actions, account-level notifications). Plain columns on audit_logs
-- and files — no FK — so the trail and file metadata outlive org deletion.
ALTER TABLE "audit_logs"           ADD COLUMN "organization_id" TEXT;
ALTER TABLE "notifications"        ADD COLUMN "organization_id" TEXT;
ALTER TABLE "outbox_messages"      ADD COLUMN "organization_id" TEXT;
ALTER TABLE "dead_letter_messages" ADD COLUMN "organization_id" TEXT;

-- ── columns that become NOT NULL: add nullable, backfill, constrain ─────────
ALTER TABLE "files"      ADD COLUMN "organization_id" TEXT;
ALTER TABLE "user_roles" ADD COLUMN "organization_id" TEXT;

-- If the database already has tenant-scoped rows from the single-tenant era,
-- park them under one placeholder organization rather than losing them.
INSERT INTO "organizations" ("id", "name", "slug", "settings", "created_at", "updated_at")
SELECT 'org_legacy_backfill', 'Legacy (pre-tenancy backfill)', 'legacy-backfill', '{}', now(), now()
WHERE EXISTS (SELECT 1 FROM "user_roles" WHERE "organization_id" IS NULL)
   OR EXISTS (SELECT 1 FROM "files" WHERE "organization_id" IS NULL)
ON CONFLICT ("id") DO NOTHING;

UPDATE "user_roles" SET "organization_id" = 'org_legacy_backfill' WHERE "organization_id" IS NULL;
UPDATE "files"      SET "organization_id" = 'org_legacy_backfill' WHERE "organization_id" IS NULL;

ALTER TABLE "files"      ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "user_roles" ALTER COLUMN "organization_id" SET NOT NULL;

-- ── user_roles primary key now includes the tenant ────────────────────────
DROP INDEX "user_roles_user_idx";
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_pk";
ALTER TABLE "user_roles" ADD  CONSTRAINT "user_roles_pk" PRIMARY KEY ("user_id", "role_id", "organization_id");

-- ── indexes ───────────────────────────────────────────────────────────────
CREATE INDEX "audit_logs_org_idx"       ON "audit_logs" ("organization_id", "created_at");
CREATE INDEX "files_org_idx"            ON "files" ("organization_id");
CREATE INDEX "user_roles_user_org_idx"  ON "user_roles" ("user_id", "organization_id");

-- ── foreign keys (user_roles + notifications only; see schema for why) ─────
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
