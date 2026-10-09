-- Raqib: confidential survey responses travel through the same protected pipeline as confidential reports
-- (separate tables and policy, explicit grants, logged sessions, optional anonymity, identity revealed only with a reason).
ALTER TABLE "raqib_conf_reports" DROP CONSTRAINT "raqib_conf_reports_kind_check";
ALTER TABLE "raqib_conf_reports" ADD CONSTRAINT "raqib_conf_reports_kind_check"
  CHECK ("kind" IN ('misconduct', 'violation', 'safety', 'survey'));
