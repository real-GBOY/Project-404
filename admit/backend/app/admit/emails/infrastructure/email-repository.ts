import { Injectable } from "@nestjs/common";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { admitDb } from "@admit/admit/db/executor.js";
import { admitId } from "@admit/admit/shared/ids.js";

export type EmailType = "INSTRUCTIONS" | "PROOF_RECEIVED" | "TICKETS" | "REJECTED" | "EXPIRED" | "CANCELLED" | "MAGIC_LINK";
export type EmailStatus = "QUEUED" | "ACCEPTED" | "DELIVERED" | "RETRYING" | "FAILED";

export interface EmailRecord {
  id: string;
  bookingId: string | null;
  type: EmailType;
  toEmail: string;
  status: EmailStatus;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  providerMessageId: string | null;
  sentAt: Date | null;
  createdAt: Date;
}

const cols = [
  "id",
  "booking_id",
  "type",
  "to_email",
  "status",
  "attempts",
  "max_attempts",
  "last_error",
  "provider_message_id",
  "sent_at",
  "created_at",
] as const;

const toEmail = (r: {
  id: string;
  booking_id: string | null;
  type: EmailType;
  to_email: string;
  status: EmailStatus;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  provider_message_id: string | null;
  sent_at: Date | null;
  created_at: Date;
}): EmailRecord => ({
  id: r.id,
  bookingId: r.booking_id,
  type: r.type,
  toEmail: r.to_email,
  status: r.status,
  attempts: r.attempts,
  maxAttempts: r.max_attempts,
  lastError: r.last_error,
  providerMessageId: r.provider_message_id,
  sentAt: r.sent_at,
  createdAt: r.created_at,
});

/**
 * The durable email outbox. `enqueue` is called inside the transaction that causes the email, so the row exists
 * if and only if the change committed. The Python worker (admit/worker) claims and delivers rows; this class only
 * ever writes the QUEUED row and serves the admin views and retry.
 */
@Injectable()
export class EmailRepository {
  /** Returns false when `dedupeKey` was already queued (a replayed transaction cannot send twice). */
  async enqueue(e: { bookingId: string | null; type: EmailType; to: string; payload: Record<string, unknown>; dedupeKey: string }): Promise<boolean> {
    const res = await admitDb()
      .insertInto("admit_email_messages")
      .values({
        id: admitId("eml"),
        organization_id: requireOrganizationId(),
        booking_id: e.bookingId,
        type: e.type,
        to_email: e.to,
        payload: e.payload,
        dedupe_key: e.dedupeKey,
      })
      .onConflict((oc) => oc.columns(["organization_id", "dedupe_key"]).where("dedupe_key", "is not", null).doNothing())
      .executeTakeFirst();
    return Number(res.numInsertedOrUpdatedRows ?? 0) === 1;
  }

  /** `eventIds = null` means every event; a list narrows to emails of bookings of those events. */
  async list(f: { eventIds?: string[] | null; bookingId?: string; status?: EmailStatus[]; limit: number; offset: number }): Promise<EmailRecord[]> {
    if (f.eventIds && !f.eventIds.length) return [];
    let q = admitDb()
      .selectFrom("admit_email_messages")
      .select([...cols]);
    if (f.eventIds) q = q.where("booking_id", "in", admitDb().selectFrom("admit_bookings").select("id").where("event_id", "in", f.eventIds));
    if (f.bookingId) q = q.where("booking_id", "=", f.bookingId);
    if (f.status?.length) q = q.where("status", "in", f.status);
    return (await q.orderBy("created_at", "desc").limit(f.limit).offset(f.offset).execute()).map(toEmail);
  }
  async forBookings(bookingIds: string[]): Promise<EmailRecord[]> {
    if (!bookingIds.length) return [];
    return (
      await admitDb()
        .selectFrom("admit_email_messages")
        .select([...cols])
        .where("booking_id", "in", bookingIds)
        .orderBy("created_at")
        .execute()
    ).map(toEmail);
  }
  async find(id: string): Promise<EmailRecord | undefined> {
    const r = await admitDb()
      .selectFrom("admit_email_messages")
      .select([...cols])
      .where("id", "=", id)
      .executeTakeFirst();
    return r ? toEmail(r) : undefined;
  }
  async countFailed(): Promise<number> {
    const r = await admitDb()
      .selectFrom("admit_email_messages")
      .select((eb) => eb.fn.countAll<string>().as("n"))
      .where("status", "=", "FAILED")
      .executeTakeFirstOrThrow();
    return Number(r.n);
  }

  /** Put a FAILED message back in the queue with a fresh attempt budget. A message that is not FAILED is left alone. */
  async requeueFailed(id: string): Promise<boolean> {
    const r = await admitDb()
      .updateTable("admit_email_messages")
      .set({ status: "QUEUED", attempts: 0, last_error: null, next_attempt_at: new Date(), claimed_by: null, claimed_at: null })
      .where("id", "=", id)
      .where("status", "=", "FAILED")
      .executeTakeFirst();
    return Number(r.numUpdatedRows) === 1;
  }
}
