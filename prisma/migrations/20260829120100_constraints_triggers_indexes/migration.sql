-- What Prisma's schema language can't express, hand-carried from the retired
-- Kysely migrations (core/*/migrations + core/kernel/db/bootstrap):
--   * string-union CHECK constraints
--   * the auric_set_updated_at() trigger + per-table triggers
--   * the audit_logs append-only (immutability) trigger
--   * the partial index backing the outbox worker's claim query
--
-- Keep this migration in sync by hand when a model's `/// @kyselyType(...)`
-- union changes or a table gains/loses `updated_at`.

-- ---------------------------------------------------------------------------
-- CHECK constraints (the DB half of the `/// @kyselyType('a' | 'b')` unions)
-- ---------------------------------------------------------------------------
ALTER TABLE "users"
  ADD CONSTRAINT "users_status_check"
  CHECK (status IN ('active', 'pending', 'disabled'));

ALTER TABLE "verification_tokens"
  ADD CONSTRAINT "verification_tokens_purpose_check"
  CHECK (purpose IN ('email_verification', 'password_reset'));

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_actor_type_check"
  CHECK (actor_type IN ('user', 'system'));

ALTER TABLE "files"
  ADD CONSTRAINT "files_visibility_check"
  CHECK (visibility IN ('private', 'public'));

ALTER TABLE "notification_templates"
  ADD CONSTRAINT "notification_templates_channel_check"
  CHECK (channel IN ('in_app', 'email'));

ALTER TABLE "outbox_messages"
  ADD CONSTRAINT "outbox_status_check"
  CHECK (status IN ('pending', 'processing', 'delivered', 'failed'));

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auric_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON "users"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();

CREATE TRIGGER roles_set_updated_at
  BEFORE UPDATE ON "roles"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();

CREATE TRIGGER organizations_set_updated_at
  BEFORE UPDATE ON "organizations"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();

CREATE TRIGGER notification_templates_set_updated_at
  BEFORE UPDATE ON "notification_templates"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();

-- ---------------------------------------------------------------------------
-- audit_logs is append-only: block UPDATE and DELETE at the database level
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auric_audit_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_mutation
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION auric_audit_immutable();

-- ---------------------------------------------------------------------------
-- The outbox worker's claim query: pending rows whose retry time has arrived.
-- ---------------------------------------------------------------------------
CREATE INDEX "outbox_ready_idx"
  ON "outbox_messages" ("next_attempt_at")
  WHERE status = 'pending';
