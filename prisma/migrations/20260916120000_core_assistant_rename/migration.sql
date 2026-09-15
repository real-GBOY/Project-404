-- Promote Mizan Copilot's conversation store to a Core-owned, domain-agnostic
-- table as part of the AI/Assistant architecture extraction
-- (core/assistant/README.md). SAFE RENAME ONLY: this table carries production
-- conversation data on Mizan's deployed VPS (docs/assistant.md — "Status: v1
-- shipped"), so nothing is dropped, recreated, or copied — every row, id, and
-- timestamp is preserved exactly as-is.

ALTER TABLE "lawfirm_ai_conversations" RENAME TO "ai_conversations";
ALTER TABLE "lawfirm_ai_messages" RENAME TO "ai_messages";

ALTER TABLE "ai_conversations" RENAME CONSTRAINT "lawfirm_ai_conversations_pkey" TO "ai_conversations_pkey";
ALTER TABLE "ai_conversations" RENAME CONSTRAINT "lawfirm_ai_conversations_org_id_uq" TO "ai_conversations_org_id_uq";
ALTER INDEX "lawfirm_ai_conversations_owner_idx" RENAME TO "ai_conversations_owner_idx";

ALTER TABLE "ai_messages" RENAME CONSTRAINT "lawfirm_ai_messages_pkey" TO "ai_messages_pkey";
ALTER TABLE "ai_messages" RENAME CONSTRAINT "lawfirm_ai_messages_role_check" TO "ai_messages_role_check";
ALTER TABLE "ai_messages" RENAME CONSTRAINT "lawfirm_ai_messages_conversation_fk" TO "ai_messages_conversation_fk";
ALTER INDEX "lawfirm_ai_messages_conversation_idx" RENAME TO "ai_messages_conversation_idx";

-- RLS policies (`tenant_isolation`) and the `updated_at` trigger are attached
-- to the table's oid, not its name — `ALTER TABLE ... RENAME` carries them
-- over automatically. Only the trigger's own name is cosmetic; renamed for
-- consistency with the new table name.
ALTER TRIGGER lawfirm_ai_conversations_set_updated_at ON "ai_conversations" RENAME TO ai_conversations_set_updated_at;
