-- core/rbac — what Prisma's schema language can't express.

CREATE TRIGGER roles_set_updated_at
  BEFORE UPDATE ON "roles"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
