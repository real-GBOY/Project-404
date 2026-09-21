-- core/organizations — what Prisma's schema language can't express.

CREATE TRIGGER organizations_set_updated_at
  BEFORE UPDATE ON "organizations"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
