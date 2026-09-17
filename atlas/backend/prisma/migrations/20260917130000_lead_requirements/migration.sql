-- Atlas AI Lead Intelligence & Property Matching (see docs/lead-intelligence.md).
--
-- Adds the raw agent notes + AI-extracted structured requirements to
-- `realestate_leads`, so the deterministic matching engine has something to
-- read on every "Generate Sales Brief" without re-running an LLM call, and so
-- an agent's correction to the extracted data persists.
--
-- Hand-written (not `prisma migrate dev`): this project's Core baseline
-- tables (ai_conversations, audit_logs, users, …) are created via copied
-- baseline SQL rather than Prisma models (see datasource.prisma), so a schema
-- diff against the live database would try to DROP all of them. Every
-- migration here is additive, hand-written SQL, applied with
-- `prisma migrate deploy` — never `migrate dev`.

ALTER TABLE "realestate_leads"
  ADD COLUMN "requirements_notes" TEXT,
  ADD COLUMN "requirements" JSONB,
  ADD COLUMN "requirements_extracted_at" TIMESTAMPTZ(6);
