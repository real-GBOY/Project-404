-- core/messaging — what Prisma's schema language can't express: string-union
-- CHECKs, partial / expression indexes, and the updated_at trigger.

ALTER TABLE "messaging_conversations"
  ADD CONSTRAINT "messaging_conversations_type_check"
  CHECK ("type" IN ('direct', 'group', 'channel'));

ALTER TABLE "messaging_conversations"
  ADD CONSTRAINT "messaging_conversations_subject_check"
  CHECK (("subject_type" IS NULL) = ("subject_id" IS NULL));

ALTER TABLE "messaging_conversation_members"
  ADD CONSTRAINT "messaging_conversation_members_role_check"
  CHECK ("role" IN ('owner', 'member'));

ALTER TABLE "messaging_messages"
  ADD CONSTRAINT "messaging_messages_type_check"
  CHECK ("message_type" IN ('text', 'system'));

-- Inbox order: latest activity first; an empty new conversation sorts by creation.
CREATE INDEX "messaging_conversations_recent_idx"
  ON "messaging_conversations" ("organization_id", (COALESCE("last_message_at", "created_at")) DESC, "id");
CREATE INDEX "messaging_conversations_subject_idx"
  ON "messaging_conversations" ("organization_id", "subject_type", "subject_id")
  WHERE "subject_type" IS NOT NULL;

-- "my conversations": active memberships of a user within a tenant.
CREATE INDEX "messaging_conversation_members_user_idx"
  ON "messaging_conversation_members" ("organization_id", "user_id")
  WHERE "left_at" IS NULL;

-- Idempotent send: a retried client message id resolves to the original row.
CREATE UNIQUE INDEX "messaging_messages_client_id_uq"
  ON "messaging_messages" ("conversation_id", "sender_id", "client_message_id")
  WHERE "client_message_id" IS NOT NULL;

-- Messages set updated_at explicitly on edit/delete; the trigger only guards conversations.
CREATE TRIGGER messaging_conversations_set_updated_at
  BEFORE UPDATE ON "messaging_conversations"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
