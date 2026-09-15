-- Replace Atlas's product-local Copilot conversation store with the Core-owned
-- `ai_conversations` / `ai_messages` tables (core/assistant/README.md — the
-- AI/Assistant architecture extraction). Atlas has no production deployment,
-- so unlike Mizan's equivalent migration (root prisma/migrations/
-- 20260916120000_core_assistant_rename, a safe rename) this one drops and
-- recreates: only local dev/demo conversation data exists, and none of it
-- needs to survive. `realestate_ai_insights` (the unrelated dashboard
-- insights banner) is untouched.

DROP TABLE "realestate_ai_messages";
DROP TABLE "realestate_ai_conversations";

-- ===========================================================================
-- Conversations — identical shape to Core's own copy of this table
-- (root prisma/schema/assistant.prisma).
-- ===========================================================================
CREATE TABLE "ai_conversations" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "user_id"         TEXT NOT NULL,
  "title"           TEXT,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_conversations_org_id_uq" UNIQUE ("organization_id", "id")
);
CREATE INDEX "ai_conversations_owner_idx"
  ON "ai_conversations" ("organization_id", "user_id", "updated_at");

-- ===========================================================================
-- Messages
-- ===========================================================================
CREATE TABLE "ai_messages" (
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
  CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_messages_role_check" CHECK ("role" IN ('user', 'assistant', 'tool')),
  CONSTRAINT "ai_messages_conversation_fk"
    FOREIGN KEY ("organization_id", "conversation_id")
    REFERENCES "ai_conversations" ("organization_id", "id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX "ai_messages_conversation_idx"
  ON "ai_messages" ("organization_id", "conversation_id", "created_at");

-- ===========================================================================
-- updated_at trigger (auric_set_updated_at() — 20260829120100)
-- ===========================================================================
CREATE TRIGGER ai_conversations_set_updated_at
  BEFORE UPDATE ON "ai_conversations"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();

-- ===========================================================================
-- Row-level security — tenant_isolation (§ docs/tenancy.md), identical shape
-- to every other tenant-scoped table.
-- ===========================================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['ai_conversations', 'ai_messages']
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
