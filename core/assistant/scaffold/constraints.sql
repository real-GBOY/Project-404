-- core/assistant — what Prisma's schema language can't express.

ALTER TABLE "ai_messages"
  ADD CONSTRAINT "ai_messages_role_check"
  CHECK ("role" IN ('user', 'assistant', 'tool'));

CREATE TRIGGER ai_conversations_set_updated_at
  BEFORE UPDATE ON "ai_conversations"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
