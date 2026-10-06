-- Raqib — data lifecycle.
--
-- erased_at   an account request whose personal details were erased after the retention period (its reference, status
--             and decision stay, so the audit trail still makes sense).
-- purged_at   evidence whose file was deleted because it outlived the organization's attachment retention. The row
--             stays (removed_at is set too) so the record shows that evidence existed and when it was purged.

ALTER TABLE "raqib_account_requests" ADD COLUMN "erased_at" TIMESTAMPTZ(6);
ALTER TABLE "raqib_evidence" ADD COLUMN "purged_at" TIMESTAMPTZ(6);
