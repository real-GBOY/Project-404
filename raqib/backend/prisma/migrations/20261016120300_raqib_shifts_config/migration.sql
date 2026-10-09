-- Raqib — shifts become configuration (settings.schedule.shifts) instead of a fixed three-value list.
-- Existing rows keep their key (morning / evening / night); new keys are validated against the organization's
-- configured shifts by the application, so the database only guarantees a well-formed key.
ALTER TABLE "raqib_visits" DROP CONSTRAINT "raqib_visits_shift_check";
ALTER TABLE "raqib_visits" ADD CONSTRAINT "raqib_visits_shift_check" CHECK ("shift" ~ '^[a-z][a-z0-9_]{1,24}$');
