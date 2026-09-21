-- core/identity — what Prisma's schema language can't express.

ALTER TABLE "users"
  ADD CONSTRAINT "users_status_check"
  CHECK (status IN ('active', 'pending', 'disabled'));

ALTER TABLE "verification_tokens"
  ADD CONSTRAINT "verification_tokens_purpose_check"
  CHECK (purpose IN ('email_verification', 'password_reset'));

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON "users"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
