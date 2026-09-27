-- AURIC Core Messaging (core/messaging/README.md, docs/messaging.md): generic
-- conversations, members, messages, attachment references and reactions.
-- Domain-agnostic — a product links a conversation to its own entity through
-- (subject_type, subject_id) and never adds columns here.
--
-- Ordering/resync design: every conversation carries two counters bumped under
-- a row lock (`SELECT … FOR UPDATE`), so writers to one conversation serialize
-- and the counters are commit-ordered:
--   seq         creation order   -> history pagination cursor
--   change_seq  create/edit/del  -> reconnect-resync cursor

CREATE TABLE "messaging_conversations" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "type"            TEXT NOT NULL,
  "title"           TEXT,
  "subject_type"    TEXT,
  "subject_id"      TEXT,
  "created_by"      TEXT NOT NULL,
  "last_message_id" TEXT,
  "last_message_at" TIMESTAMPTZ(6),
  "last_seq"        BIGINT NOT NULL DEFAULT 0,
  "last_change_seq" BIGINT NOT NULL DEFAULT 0,
  "archived_at"     TIMESTAMPTZ(6),
  "metadata"        JSONB NOT NULL DEFAULT '{}',
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "messaging_conversations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "messaging_conversations_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "messaging_conversations_type_check" CHECK ("type" IN ('direct', 'group', 'channel')),
  CONSTRAINT "messaging_conversations_subject_check"
    CHECK (("subject_type" IS NULL) = ("subject_id" IS NULL))
);
-- Inbox order: latest activity first; an empty new conversation sorts by creation.
CREATE INDEX "messaging_conversations_recent_idx"
  ON "messaging_conversations" ("organization_id", (COALESCE("last_message_at", "created_at")) DESC, "id");
CREATE INDEX "messaging_conversations_subject_idx"
  ON "messaging_conversations" ("organization_id", "subject_type", "subject_id")
  WHERE "subject_type" IS NOT NULL;

CREATE TABLE "messaging_conversation_members" (
  "conversation_id"       TEXT NOT NULL,
  "user_id"               TEXT NOT NULL,
  "organization_id"       TEXT NOT NULL,
  "role"                  TEXT NOT NULL DEFAULT 'member',
  "joined_at"             TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "left_at"               TIMESTAMPTZ(6),
  "last_read_message_id"  TEXT,
  "last_read_at"          TIMESTAMPTZ(6),
  "muted"                 BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT "messaging_conversation_members_pkey" PRIMARY KEY ("conversation_id", "user_id"),
  CONSTRAINT "messaging_conversation_members_role_check" CHECK ("role" IN ('owner', 'member')),
  CONSTRAINT "messaging_conversation_members_conversation_fk"
    FOREIGN KEY ("organization_id", "conversation_id")
    REFERENCES "messaging_conversations" ("organization_id", "id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);
-- "my conversations": active memberships of a user within a tenant.
CREATE INDEX "messaging_conversation_members_user_idx"
  ON "messaging_conversation_members" ("organization_id", "user_id")
  WHERE "left_at" IS NULL;

CREATE TABLE "messaging_messages" (
  "id"                  TEXT NOT NULL,
  "conversation_id"     TEXT NOT NULL,
  "organization_id"     TEXT NOT NULL,
  "sender_id"           TEXT NOT NULL,
  "body"                TEXT NOT NULL,
  "message_type"        TEXT NOT NULL DEFAULT 'text',
  "client_message_id"   TEXT,
  "reply_to_message_id" TEXT,
  "seq"                 BIGINT NOT NULL,
  "change_seq"          BIGINT NOT NULL,
  "metadata"            JSONB NOT NULL DEFAULT '{}',
  "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "edited_at"           TIMESTAMPTZ(6),
  "deleted_at"          TIMESTAMPTZ(6),
  CONSTRAINT "messaging_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "messaging_messages_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "messaging_messages_seq_uq" UNIQUE ("conversation_id", "seq"),
  CONSTRAINT "messaging_messages_type_check" CHECK ("message_type" IN ('text', 'system')),
  CONSTRAINT "messaging_messages_conversation_fk"
    FOREIGN KEY ("organization_id", "conversation_id")
    REFERENCES "messaging_conversations" ("organization_id", "id")
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "messaging_messages_reply_fk"
    FOREIGN KEY ("organization_id", "reply_to_message_id")
    REFERENCES "messaging_messages" ("organization_id", "id")
    ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX "messaging_messages_change_idx"
  ON "messaging_messages" ("conversation_id", "change_seq");
-- Idempotent send: a retried client message id resolves to the original row.
CREATE UNIQUE INDEX "messaging_messages_client_id_uq"
  ON "messaging_messages" ("conversation_id", "sender_id", "client_message_id")
  WHERE "client_message_id" IS NOT NULL;

CREATE TABLE "messaging_message_attachments" (
  "id"              TEXT NOT NULL,
  "message_id"      TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  -- References Core `files`. Deliberately no FK: file metadata outlives its uses.
  "file_id"         TEXT NOT NULL,
  -- Snapshot of the file's display metadata at send time (no cross-module join to render a message).
  "file_name"       TEXT NOT NULL,
  "content_type"    TEXT NOT NULL,
  "byte_size"       BIGINT NOT NULL,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "messaging_message_attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "messaging_message_attachments_uq" UNIQUE ("message_id", "file_id"),
  CONSTRAINT "messaging_message_attachments_message_fk"
    FOREIGN KEY ("organization_id", "message_id")
    REFERENCES "messaging_messages" ("organization_id", "id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX "messaging_message_attachments_conversation_idx"
  ON "messaging_message_attachments" ("conversation_id", "message_id");

CREATE TABLE "messaging_message_reactions" (
  "message_id"      TEXT NOT NULL,
  "user_id"         TEXT NOT NULL,
  "emoji"           TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "messaging_message_reactions_pkey" PRIMARY KEY ("message_id", "user_id", "emoji"),
  CONSTRAINT "messaging_message_reactions_message_fk"
    FOREIGN KEY ("organization_id", "message_id")
    REFERENCES "messaging_messages" ("organization_id", "id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);

-- updated_at trigger (auric_set_updated_at() — 20260829120100). Messages set
-- updated_at explicitly on edit/delete; the trigger only guards conversations.
CREATE TRIGGER messaging_conversations_set_updated_at
  BEFORE UPDATE ON "messaging_conversations"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();

-- Row-level security — tenant_isolation (§ docs/tenancy.md).
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'messaging_conversations', 'messaging_conversation_members', 'messaging_messages',
    'messaging_message_attachments', 'messaging_message_reactions'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (organization_id = current_setting(''app.organization_id'', true))
         WITH CHECK (organization_id = current_setting(''app.organization_id'', true))',
      t
    );
  END LOOP;
END $$;
