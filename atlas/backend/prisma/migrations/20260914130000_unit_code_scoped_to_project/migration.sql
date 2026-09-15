-- realestate_units.code is only unique WITHIN a project, not organization-wide:
-- a short building key like "A" is reused across different projects (every
-- project can have its own "Building A"), so a global-per-org unique code
-- collides the first time two projects each generate a floor plate.
ALTER TABLE "realestate_units" DROP CONSTRAINT "realestate_units_org_code_uq";
ALTER TABLE "realestate_units" ADD CONSTRAINT "realestate_units_project_code_uq" UNIQUE ("organization_id", "project_id", "code");
