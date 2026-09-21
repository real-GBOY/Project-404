-- core/files — what Prisma's schema language can't express.

ALTER TABLE "files"
  ADD CONSTRAINT "files_visibility_check"
  CHECK (visibility IN ('private', 'public'));
