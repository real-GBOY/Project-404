-- core/notifications — what Prisma's schema language can't express.

ALTER TABLE "notification_templates"
  ADD CONSTRAINT "notification_templates_channel_check"
  CHECK (channel IN ('in_app', 'email'));

CREATE TRIGGER notification_templates_set_updated_at
  BEFORE UPDATE ON "notification_templates"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
