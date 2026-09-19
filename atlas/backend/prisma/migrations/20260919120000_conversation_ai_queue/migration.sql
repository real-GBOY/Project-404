-- Coalesce analysis requests (docs/messaging.md §7).
--
-- One analysis request per MESSAGE meant a burst of N messages queued N outbox rows,
-- each of which called the LLM — a burst could trip the provider's rate limit and
-- exhaust every retry. `queued_at` marks "a request is already waiting for this
-- conversation": the message subscriber only enqueues when it flips NULL -> set, and the
-- analyzer clears it when it claims the conversation. A stale marker (crashed worker,
-- dead-lettered request) expires so it can never block analysis permanently.

ALTER TABLE "realestate_conversation_ai_state" ADD COLUMN "queued_at" TIMESTAMPTZ(6);
