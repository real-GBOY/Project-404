-- Atlas Conversation Intelligence (docs/messaging.md §7): the incremental AI
-- analysis state kept per Core messaging conversation.
--
-- Atlas-owned (real-estate meaning: requirements, action items, open questions)
-- — Core's `messaging_conversations` knows nothing about it. One row per
-- analysed conversation; the analyzer folds NEW messages into it
-- (previous state + new messages = updated state) and records how far it got in
-- `last_analyzed_change_seq`, the same per-conversation cursor Core hands to
-- reconnecting clients. `status`/`running_at` make the analysis single-flight.
--
-- Hand-written, additive SQL (see 20260917130000_lead_requirements for why).

CREATE TABLE "realestate_conversation_ai_state" (
  "conversation_id"           TEXT NOT NULL,
  "organization_id"           TEXT NOT NULL,
  "summary"                   TEXT NOT NULL DEFAULT '',
  "key_facts"                 JSONB NOT NULL DEFAULT '[]',
  "action_items"              JSONB NOT NULL DEFAULT '[]',
  "unresolved_questions"      JSONB NOT NULL DEFAULT '[]',
  -- Same shape as realestate_leads.requirements (lead-intelligence's schema).
  "extracted_requirements"    JSONB,
  -- How far the analysis has read: `change_seq` (creates + edits + deletes) and
  -- `seq` (creation order — tells a NEW message from a reaction-only touch).
  "last_analyzed_change_seq"  BIGINT NOT NULL DEFAULT 0,
  "last_analyzed_seq"         BIGINT NOT NULL DEFAULT 0,
  "version"                   INTEGER NOT NULL DEFAULT 0,
  "status"                    TEXT NOT NULL DEFAULT 'idle',
  "running_at"                TIMESTAMPTZ(6),
  "last_error"                TEXT,
  "analyzed_at"               TIMESTAMPTZ(6),
  "created_at"                TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "realestate_conversation_ai_state_pkey" PRIMARY KEY ("conversation_id"),
  CONSTRAINT "realestate_conversation_ai_state_status_check"
    CHECK ("status" IN ('idle', 'running', 'failed')),
  CONSTRAINT "realestate_conversation_ai_state_conversation_fk"
    FOREIGN KEY ("organization_id", "conversation_id")
    REFERENCES "messaging_conversations" ("organization_id", "id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX "realestate_conversation_ai_state_org_idx"
  ON "realestate_conversation_ai_state" ("organization_id", "status");

CREATE TRIGGER realestate_conversation_ai_state_set_updated_at
  BEFORE UPDATE ON "realestate_conversation_ai_state"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();

ALTER TABLE "realestate_conversation_ai_state" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "realestate_conversation_ai_state" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "realestate_conversation_ai_state"
  USING      (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));
