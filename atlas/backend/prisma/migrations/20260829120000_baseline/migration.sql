-- Baseline: the full v0.1 schema, mirroring what the retired Kysely migrator
-- created (core/*/migrations + core/kernel/db/bootstrap). Objects Prisma
-- cannot express (CHECK constraints, triggers, the partial index) live in the
-- next migration.

-- citext must exist before "users"."email_normalized" (CITEXT) is created.
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_type" TEXT NOT NULL DEFAULT 'user',
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "correlation_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_messages" (
    "id" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL,
    "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT,
    "locked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMPTZ(6),

    CONSTRAINT "outbox_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dead_letter_messages" (
    "id" TEXT NOT NULL,
    "outbox_id" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL,
    "last_error" TEXT NOT NULL,
    "retry_history" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replayed_at" TIMESTAMPTZ(6),

    CONSTRAINT "dead_letter_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "driver" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "byte_size" BIGINT NOT NULL,
    "checksum_sha256" TEXT NOT NULL,
    "owner_id" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_normalized" CITEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "email_verified_at" TIMESTAMPTZ(6),
    "locale" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "rotated_to" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "data" JSONB,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "membership_role" TEXT NOT NULL DEFAULT 'member',
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pk" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "granted_by" TEXT,

    CONSTRAINT "user_roles_pk" PRIMARY KEY ("user_id","role_id")
);

-- CreateIndex
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "files_owner_idx" ON "files"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_normalized_key" ON "users"("email_normalized");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_hash_key" ON "verification_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "verification_tokens_user_purpose_idx" ON "verification_tokens"("user_id", "purpose");

-- CreateIndex
CREATE INDEX "notifications_user_unread_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_uq" ON "notification_templates"("key", "locale", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organization_members_user_idx" ON "organization_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_uq" ON "organization_members"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_action_resource_uq" ON "permissions"("action", "resource");

-- CreateIndex
CREATE INDEX "user_roles_user_idx" ON "user_roles"("user_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
