-- core/events — what Prisma's schema language can't express.

ALTER TABLE "outbox_messages"
  ADD CONSTRAINT "outbox_status_check"
  CHECK (status IN ('pending', 'processing', 'delivered', 'failed'));

-- The outbox worker's claim query: pending rows whose retry time has arrived.
CREATE INDEX "outbox_ready_idx"
  ON "outbox_messages" ("next_attempt_at")
  WHERE status = 'pending';
