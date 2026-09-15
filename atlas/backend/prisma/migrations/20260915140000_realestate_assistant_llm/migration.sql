-- Atlas Copilot upgrade: real LLM (Groq) with tool-orchestration, replacing the
-- server-side keyword-matched canned-answer stub. `realestate_ai_messages`
-- moves from the old UI-card shape (text/detail/recommend/stats/rows/cites/
-- follow/is_action, role user|ai) to a Chat-Completions transcript shape
-- (content/tool_calls/tool_call_id/tool_name/metadata, role user|assistant|
-- tool) — mirrors Mizan Copilot's `lawfirm_ai_messages`. See docs/atlas-assistant.md.

ALTER TABLE "realestate_ai_messages" DROP CONSTRAINT "realestate_ai_messages_role_check";

ALTER TABLE "realestate_ai_messages"
  ADD COLUMN "content" TEXT,
  ADD COLUMN "tool_calls" JSONB,
  ADD COLUMN "tool_call_id" TEXT,
  ADD COLUMN "tool_name" TEXT,
  ADD COLUMN "metadata" JSONB,
  -- `created_at` alone is not a safe transcript order: Postgres's
  -- `CURRENT_TIMESTAMP` resolves to the enclosing transaction's start time, so
  -- two messages appended in quick, separate transactions (a user turn, then
  -- an assistant turn) can tie. `seq` is a strictly increasing insertion order.
  ADD COLUMN "seq" BIGSERIAL;

UPDATE "realestate_ai_messages" SET "content" = "text";

ALTER TABLE "realestate_ai_messages"
  DROP COLUMN "text",
  DROP COLUMN "detail",
  DROP COLUMN "recommend",
  DROP COLUMN "stats",
  DROP COLUMN "rows",
  DROP COLUMN "cites",
  DROP COLUMN "follow",
  DROP COLUMN "is_action";

UPDATE "realestate_ai_messages" SET "role" = 'assistant' WHERE "role" = 'ai';

ALTER TABLE "realestate_ai_messages"
  ADD CONSTRAINT "realestate_ai_messages_role_check" CHECK ("role" IN ('user', 'assistant', 'tool'));
