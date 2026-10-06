-- A project that has ended can be closed: it stays in history and reports but takes no new visits.
ALTER TABLE "raqib_projects" DROP CONSTRAINT "raqib_projects_status_check";
ALTER TABLE "raqib_projects" ADD CONSTRAINT "raqib_projects_status_check"
  CHECK ("status" IN ('active', 'attention', 'mobilizing', 'closed'));
