-- Mizan Copilot — conversation store for mizan/backend/app/lawfirm/assistant.
--
-- Same shape as the rest of the law-firm domain (20260902120000_lawfirm):
-- composite (organization_id, id) unique keys, a composite FK to the parent so
-- a child tagged with the wrong tenant is rejected by the FK, a string-union
-- CHECK, the shared updated_at trigger, list indexes, and tenant_isolation RLS.

-- ===========================================================================
-- Conversations
-- ===========================================================================
CREATE TABLE "lawfirm_ai_conversations" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "user_id"         TEXT NOT NULL,
  "title"           TEXT,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lawfirm_ai_conversations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lawfirm_ai_conversations_org_id_uq" UNIQUE ("organization_id", "id")
);
CREATE INDEX "lawfirm_ai_conversations_owner_idx"
  ON "lawfirm_ai_conversations" ("organization_id", "user_id", "updated_at");

-- ===========================================================================
-- Messages
-- ===========================================================================
CREATE TABLE "lawfirm_ai_messages" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "role"            TEXT NOT NULL,
  "content"         TEXT,
  "tool_calls"      JSONB,
  "tool_call_id"    TEXT,
  "tool_name"       TEXT,
  "metadata"        JSONB,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lawfirm_ai_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lawfirm_ai_messages_role_check" CHECK ("role" IN ('user', 'assistant', 'tool')),
  CONSTRAINT "lawfirm_ai_messages_conversation_fk"
    FOREIGN KEY ("organization_id", "conversation_id")
    REFERENCES "lawfirm_ai_conversations" ("organization_id", "id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX "lawfirm_ai_messages_conversation_idx"
  ON "lawfirm_ai_messages" ("organization_id", "conversation_id", "created_at");

-- ===========================================================================
-- updated_at trigger (auric_set_updated_at() — 20260829120100)
-- ===========================================================================
CREATE TRIGGER lawfirm_ai_conversations_set_updated_at
  BEFORE UPDATE ON "lawfirm_ai_conversations"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();

-- ===========================================================================
-- Row-level security — tenant_isolation (§ docs/tenancy.md), identical shape
-- to every other lawfirm_* table.
-- ===========================================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['lawfirm_ai_conversations', 'lawfirm_ai_messages']
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
