-- Raqib — corrective-action escalation (client feedback round 1).
--
-- An unresolved corrective action escalates at the configured day thresholds (settings.escalation; 3, 6 and 9 by
-- default). The highest level already announced is kept on the action so a job re-run never repeats an escalation, and
-- each escalation is also written into the action's immutable history as an 'escalated' event.
ALTER TABLE "raqib_corrective_actions" ADD COLUMN "escalation_level" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "raqib_corrective_actions" ADD CONSTRAINT "raqib_corrective_actions_escalation_check" CHECK ("escalation_level" BETWEEN 0 AND 5);

ALTER TABLE "raqib_action_events" DROP CONSTRAINT "raqib_action_events_kind_check";
ALTER TABLE "raqib_action_events" ADD CONSTRAINT "raqib_action_events_kind_check"
  CHECK ("kind" IN ('created', 'started', 'submitted', 'comment', 'returned', 'closed', 'reassigned', 'escalated'));
