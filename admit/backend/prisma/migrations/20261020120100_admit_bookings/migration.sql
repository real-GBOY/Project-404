-- Admit bookings: bookings, lines, payment submissions, tickets, scan attempts, booking timeline, email outbox.
-- Hand-written; prisma/schema/admit-bookings.prisma mirrors it for Kysely type generation only.

-- ===========================================================================
-- Bookings. Guest checkout: no user account. A booking is reached by its public `ref` PLUS the
-- magic-link secret whose SHA-256 is `access_hash` — the ref alone grants nothing.
-- `version` is bumped on every state change (optimistic concurrency for reviewers).
-- ===========================================================================
CREATE TABLE "admit_bookings" (
  "id"                TEXT NOT NULL,
  "organization_id"   TEXT NOT NULL,
  "event_id"          TEXT NOT NULL,
  "ref"               TEXT NOT NULL,
  "access_hash"       TEXT NOT NULL,
  "status"            TEXT NOT NULL DEFAULT 'AWAITING_PAYMENT',
  "customer_name"     TEXT NOT NULL,
  "email"             TEXT NOT NULL,
  "phone"             TEXT NOT NULL,
  "total_minor"       INTEGER NOT NULL,
  "currency"          TEXT NOT NULL,
  "hold_expires_at"   TIMESTAMPTZ(6) NOT NULL,
  "policy_ack"        BOOLEAN NOT NULL DEFAULT false,
  "rejection_reason"  TEXT,
  "version"           INTEGER NOT NULL DEFAULT 1,
  "idempotency_key"   TEXT,
  "confirmed_at"      TIMESTAMPTZ(6),
  "cancelled_at"      TIMESTAMPTZ(6),
  "created_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admit_bookings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admit_bookings_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "admit_bookings_ref_uq" UNIQUE ("organization_id", "ref"),
  CONSTRAINT "admit_bookings_org_fk" FOREIGN KEY ("organization_id")
    REFERENCES "organizations" ("id") ON DELETE CASCADE,
  CONSTRAINT "admit_bookings_event_fk" FOREIGN KEY ("organization_id", "event_id")
    REFERENCES "admit_events" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "admit_bookings_status_check" CHECK ("status" IN
    ('AWAITING_PAYMENT', 'IN_REVIEW', 'CONFIRMED', 'REJECTED', 'EXPIRED', 'CANCELLED')),
  CONSTRAINT "admit_bookings_total_check" CHECK ("total_minor" >= 0)
);
-- Same idempotency key from the same client creates exactly one booking.
CREATE UNIQUE INDEX "admit_bookings_idem_uq" ON "admit_bookings" ("organization_id", "idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;
CREATE INDEX "admit_bookings_event_idx" ON "admit_bookings" ("organization_id", "event_id", "status");
-- Expiry sweep: only bookings still holding inventory without proof (REJECTED is terminal and releases).
CREATE INDEX "admit_bookings_hold_idx" ON "admit_bookings" ("hold_expires_at")
  WHERE "status" = 'AWAITING_PAYMENT';

CREATE TABLE "admit_booking_lines" (
  "id"               TEXT NOT NULL,
  "organization_id"  TEXT NOT NULL,
  "booking_id"       TEXT NOT NULL,
  "ticket_type_id"   TEXT NOT NULL,
  "quantity"         INTEGER NOT NULL,
  "unit_price_minor" INTEGER NOT NULL,
  "holder_names"     JSONB NOT NULL DEFAULT '[]',
  CONSTRAINT "admit_booking_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admit_booking_lines_uq" UNIQUE ("booking_id", "ticket_type_id"),
  CONSTRAINT "admit_booking_lines_booking_fk" FOREIGN KEY ("organization_id", "booking_id")
    REFERENCES "admit_bookings" ("organization_id", "id") ON DELETE CASCADE,
  CONSTRAINT "admit_booking_lines_type_fk" FOREIGN KEY ("organization_id", "ticket_type_id")
    REFERENCES "admit_ticket_types" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "admit_booking_lines_qty_check" CHECK ("quantity" BETWEEN 1 AND 6),
  CONSTRAINT "admit_booking_lines_price_check" CHECK ("unit_price_minor" >= 0),
  CONSTRAINT "admit_booking_lines_names_check" CHECK (jsonb_typeof("holder_names") = 'array')
);
CREATE INDEX "admit_booking_lines_type_idx" ON "admit_booking_lines" ("organization_id", "ticket_type_id");

-- ===========================================================================
-- Payment submissions (proof of an external transfer). Review is version-checked: approve/reject are
-- `UPDATE … WHERE status = 'SUBMITTED' AND version = $v`. The soft lock (claimed_*) is advisory only.
-- ===========================================================================
CREATE TABLE "admit_payment_submissions" (
  "id"               TEXT NOT NULL,
  "organization_id"  TEXT NOT NULL,
  "booking_id"       TEXT NOT NULL,
  "method_id"        TEXT,
  "file_id"          TEXT NOT NULL,
  "txn_id"           TEXT,
  "sent_from"        TEXT,
  "amount_minor"     INTEGER,
  "status"           TEXT NOT NULL DEFAULT 'SUBMITTED',
  "version"          INTEGER NOT NULL DEFAULT 1,
  "claimed_by"       TEXT,
  "claimed_at"       TIMESTAMPTZ(6),
  "decided_by"       TEXT,
  "decided_at"       TIMESTAMPTZ(6),
  "customer_reason"  TEXT,
  "internal_note"    TEXT,
  "decision_key"     TEXT,
  "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admit_payment_submissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admit_payment_submissions_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "admit_payment_submissions_booking_fk" FOREIGN KEY ("organization_id", "booking_id")
    REFERENCES "admit_bookings" ("organization_id", "id") ON DELETE CASCADE,
  CONSTRAINT "admit_payment_submissions_method_fk" FOREIGN KEY ("organization_id", "method_id")
    REFERENCES "admit_payment_methods" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "admit_payment_submissions_status_check" CHECK ("status" IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'SUPERSEDED')),
  CONSTRAINT "admit_payment_submissions_reason_check" CHECK
    ("status" <> 'REJECTED' OR char_length(coalesce("customer_reason", '')) BETWEEN 10 AND 500)
);
-- At most one submission awaits a decision per booking.
CREATE UNIQUE INDEX "admit_payment_submissions_open_uq" ON "admit_payment_submissions" ("organization_id", "booking_id")
  WHERE "status" = 'SUBMITTED';
CREATE INDEX "admit_payment_submissions_queue_idx" ON "admit_payment_submissions" ("organization_id", "status", "created_at");
-- A repeated decision request (same idempotency key) returns the first result.
CREATE UNIQUE INDEX "admit_payment_submissions_decision_uq" ON "admit_payment_submissions" ("organization_id", "decision_key")
  WHERE "decision_key" IS NOT NULL;

-- ===========================================================================
-- Tickets — created only by issuance, one per seat, idempotent per booking via (booking_id, seq).
-- `token_hash` is SHA-256 of the 128-bit QR token; the token itself is derived (HMAC) at render time
-- and never stored. Never deleted: revocation is a status.
-- ===========================================================================
CREATE TABLE "admit_tickets" (
  "id"               TEXT NOT NULL,
  "organization_id"  TEXT NOT NULL,
  "booking_id"       TEXT NOT NULL,
  "event_id"         TEXT NOT NULL,
  "ticket_type_id"   TEXT NOT NULL,
  "seq"              INTEGER NOT NULL,
  "holder_name"      TEXT NOT NULL,
  "token_hash"       TEXT NOT NULL,
  "status"           TEXT NOT NULL DEFAULT 'VALID',
  "checked_in_at"    TIMESTAMPTZ(6),
  "checked_in_gate"  TEXT,
  "checked_in_by"    TEXT,
  "revoked_at"       TIMESTAMPTZ(6),
  "revoked_by"       TEXT,
  "revoked_reason"   TEXT,
  "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admit_tickets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admit_tickets_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "admit_tickets_seq_uq" UNIQUE ("booking_id", "seq"),
  CONSTRAINT "admit_tickets_token_uq" UNIQUE ("token_hash"),
  CONSTRAINT "admit_tickets_booking_fk" FOREIGN KEY ("organization_id", "booking_id")
    REFERENCES "admit_bookings" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "admit_tickets_event_fk" FOREIGN KEY ("organization_id", "event_id")
    REFERENCES "admit_events" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "admit_tickets_type_fk" FOREIGN KEY ("organization_id", "ticket_type_id")
    REFERENCES "admit_ticket_types" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "admit_tickets_status_check" CHECK ("status" IN ('VALID', 'USED', 'REVOKED')),
  CONSTRAINT "admit_tickets_used_check" CHECK ("status" <> 'USED' OR "checked_in_at" IS NOT NULL),
  CONSTRAINT "admit_tickets_revoked_check" CHECK ("status" <> 'REVOKED' OR "revoked_at" IS NOT NULL)
);
CREATE INDEX "admit_tickets_event_idx" ON "admit_tickets" ("organization_id", "event_id", "status");

-- ===========================================================================
-- Scan attempts — every door scan, with its verdict. NETWORK_ERROR is never written (nothing reached
-- the server); PENDING exists only client-side.
-- ===========================================================================
CREATE TABLE "admit_scan_attempts" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "event_id"        TEXT NOT NULL,
  "ticket_id"       TEXT,
  "result"          TEXT NOT NULL,
  "reason"          TEXT,
  "method"          TEXT NOT NULL DEFAULT 'QR',
  "gate"            TEXT NOT NULL DEFAULT '',
  "staff_id"        TEXT,
  "scanned_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admit_scan_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admit_scan_attempts_event_fk" FOREIGN KEY ("organization_id", "event_id")
    REFERENCES "admit_events" ("organization_id", "id") ON DELETE CASCADE,
  CONSTRAINT "admit_scan_attempts_result_check" CHECK ("result" IN ('ADMITTED', 'ALREADY_USED', 'INVALID')),
  CONSTRAINT "admit_scan_attempts_method_check" CHECK ("method" IN ('QR', 'MANUAL')),
  CONSTRAINT "admit_scan_attempts_reason_check" CHECK ("reason" IS NULL OR "reason" IN ('unknown', 'revoked', 'other_event', 'event_closed'))
);
CREATE INDEX "admit_scan_attempts_event_idx" ON "admit_scan_attempts" ("organization_id", "event_id", "scanned_at" DESC);

-- ===========================================================================
-- Booking timeline — the customer-visible and admin-visible history of a booking.
-- ===========================================================================
CREATE TABLE "admit_booking_timeline" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "booking_id"      TEXT NOT NULL,
  "step"            TEXT NOT NULL,
  "state"           TEXT NOT NULL DEFAULT 'done',
  "actor_id"        TEXT,
  "note"            TEXT,
  "at"              TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admit_booking_timeline_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admit_booking_timeline_booking_fk" FOREIGN KEY ("organization_id", "booking_id")
    REFERENCES "admit_bookings" ("organization_id", "id") ON DELETE CASCADE,
  CONSTRAINT "admit_booking_timeline_state_check" CHECK ("state" IN ('done', 'pending', 'failed'))
);
CREATE INDEX "admit_booking_timeline_idx" ON "admit_booking_timeline" ("organization_id", "booking_id", "at");

-- ===========================================================================
-- Email messages — the durable email outbox the Python worker drains. A row is written in the SAME
-- transaction as the state change that causes it. The worker claims rows with FOR UPDATE SKIP LOCKED,
-- renders from `payload` (ids + values already decided by the API), sends, and writes the outcome back.
-- It never decides anything. A FAILED email never changes a booking or ticket.
-- ===========================================================================
CREATE TABLE "admit_email_messages" (
  "id"                  TEXT NOT NULL,
  "organization_id"     TEXT NOT NULL,
  "booking_id"          TEXT,
  "type"                TEXT NOT NULL,
  "to_email"            TEXT NOT NULL,
  "payload"             JSONB NOT NULL DEFAULT '{}',
  "status"              TEXT NOT NULL DEFAULT 'QUEUED',
  "attempts"            INTEGER NOT NULL DEFAULT 0,
  "max_attempts"        INTEGER NOT NULL DEFAULT 3,
  "next_attempt_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimed_by"          TEXT,
  "claimed_at"          TIMESTAMPTZ(6),
  "last_error"          TEXT,
  "provider_message_id" TEXT,
  "dedupe_key"          TEXT,
  "sent_at"             TIMESTAMPTZ(6),
  "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admit_email_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admit_email_messages_org_fk" FOREIGN KEY ("organization_id")
    REFERENCES "organizations" ("id") ON DELETE CASCADE,
  CONSTRAINT "admit_email_messages_booking_fk" FOREIGN KEY ("organization_id", "booking_id")
    REFERENCES "admit_bookings" ("organization_id", "id") ON DELETE CASCADE,
  CONSTRAINT "admit_email_messages_type_check" CHECK ("type" IN
    ('INSTRUCTIONS', 'PROOF_RECEIVED', 'TICKETS', 'REJECTED', 'EXPIRED', 'CANCELLED', 'MAGIC_LINK')),
  CONSTRAINT "admit_email_messages_status_check" CHECK ("status" IN
    ('QUEUED', 'ACCEPTED', 'DELIVERED', 'RETRYING', 'FAILED')),
  CONSTRAINT "admit_email_messages_payload_check" CHECK (jsonb_typeof("payload") = 'object')
);
-- One email per (booking, type, event) — a replayed transaction cannot queue a duplicate.
CREATE UNIQUE INDEX "admit_email_messages_dedupe_uq" ON "admit_email_messages" ("organization_id", "dedupe_key")
  WHERE "dedupe_key" IS NOT NULL;
-- The worker's claim query.
CREATE INDEX "admit_email_messages_due_idx" ON "admit_email_messages" ("next_attempt_at")
  WHERE "status" IN ('QUEUED', 'RETRYING');
CREATE INDEX "admit_email_messages_list_idx" ON "admit_email_messages" ("organization_id", "created_at" DESC);

-- ===========================================================================
-- updated_at triggers
-- ===========================================================================
CREATE TRIGGER admit_bookings_set_updated_at BEFORE UPDATE ON "admit_bookings"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER admit_payment_submissions_set_updated_at BEFORE UPDATE ON "admit_payment_submissions"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER admit_tickets_set_updated_at BEFORE UPDATE ON "admit_tickets"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER admit_email_messages_set_updated_at BEFORE UPDATE ON "admit_email_messages"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();

-- ===========================================================================
-- Row-level security — tenant_isolation on every table above.
-- ===========================================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['admit_bookings', 'admit_booking_lines', 'admit_payment_submissions', 'admit_tickets',
                           'admit_scan_attempts', 'admit_booking_timeline', 'admit_email_messages']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (organization_id = current_setting(''app.organization_id'', true))
         WITH CHECK (organization_id = current_setting(''app.organization_id'', true))',
      t
    );
  END LOOP;
END $$;

-- ===========================================================================
-- Public-API rate limits — fixed-window counters shared by every API instance. Global (not tenant
-- data) and only touched on the system connection; old windows are pruned by the scheduled jobs.
-- ===========================================================================
CREATE TABLE "admit_rate_limits" (
  "bucket"       TEXT NOT NULL,
  "window_start" TIMESTAMPTZ(6) NOT NULL,
  "hits"         INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "admit_rate_limits_pkey" PRIMARY KEY ("bucket", "window_start")
);
CREATE INDEX "admit_rate_limits_window_idx" ON "admit_rate_limits" ("window_start");
