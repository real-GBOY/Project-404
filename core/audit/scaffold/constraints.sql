-- core/audit — what Prisma's schema language can't express.

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_actor_type_check"
  CHECK (actor_type IN ('user', 'system'));

-- audit_logs is append-only: block UPDATE and DELETE at the database level.
CREATE OR REPLACE FUNCTION auric_audit_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_mutation
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION auric_audit_immutable();
