-- Raqib: the Administrative Staff role (key adm). Widens the three role CHECK constraints; no data changes.
ALTER TABLE "raqib_role_templates" DROP CONSTRAINT "raqib_role_templates_role_check";
ALTER TABLE "raqib_role_templates" ADD CONSTRAINT "raqib_role_templates_role_check"
  CHECK ("role_key" IN ('qm', 'qe', 'pm', 'ins', 'gs', 'guard', 'gm', 'adm'));
ALTER TABLE "raqib_profiles" DROP CONSTRAINT "raqib_profiles_role_check";
ALTER TABLE "raqib_profiles" ADD CONSTRAINT "raqib_profiles_role_check"
  CHECK ("role_key" IN ('qm', 'qe', 'pm', 'ins', 'gs', 'guard', 'gm', 'adm'));
ALTER TABLE "raqib_account_requests" DROP CONSTRAINT "raqib_account_requests_role_check";
ALTER TABLE "raqib_account_requests" ADD CONSTRAINT "raqib_account_requests_role_check"
  CHECK ("requested_role" IN ('qe', 'pm', 'ins', 'gs', 'guard', 'adm'));
