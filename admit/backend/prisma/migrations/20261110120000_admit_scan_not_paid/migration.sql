-- A door scan of a booking reference whose booking has no issued tickets (payment not approved) is its own refusal: "not paid yet".
ALTER TABLE "admit_scan_attempts" DROP CONSTRAINT "admit_scan_attempts_reason_check";
ALTER TABLE "admit_scan_attempts"
  ADD CONSTRAINT "admit_scan_attempts_reason_check"
  CHECK ("reason" IS NULL OR "reason" IN ('unknown', 'revoked', 'other_event', 'event_closed', 'not_paid'));
