-- AURIC Core — database prelude. Runs BEFORE the Prisma-generated tables.
--
-- citext must exist before "users"."email_normalized" (CITEXT) is created.
CREATE EXTENSION IF NOT EXISTS "citext";

-- Shared `updated_at` maintenance. Modules attach it per table
-- (BEFORE UPDATE ... EXECUTE FUNCTION auric_set_updated_at()).
CREATE OR REPLACE FUNCTION auric_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
