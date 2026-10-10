import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { admitDb } from "@admit/admit/db/executor.js";
import { admitId } from "@admit/admit/shared/ids.js";

export type SubmissionStatus = "SUBMITTED" | "APPROVED" | "REJECTED" | "SUPERSEDED";

export interface SubmissionRecord {
  id: string;
  bookingId: string;
  methodId: string | null;
  fileId: string;
  txnId: string | null;
  sentFrom: string | null;
  amountMinor: number | null;
  status: SubmissionStatus;
  version: number;
  claimedBy: string | null;
  claimedAt: Date | null;
  decidedBy: string | null;
  decidedAt: Date | null;
  customerReason: string | null;
  internalNote: string | null;
  createdAt: Date;
}

const cols = [
  "id",
  "booking_id",
  "method_id",
  "file_id",
  "txn_id",
  "sent_from",
  "amount_minor",
  "status",
  "version",
  "claimed_by",
  "claimed_at",
  "decided_by",
  "decided_at",
  "customer_reason",
  "internal_note",
  "created_at",
] as const;

const toSub = (r: {
  id: string;
  booking_id: string;
  method_id: string | null;
  file_id: string;
  txn_id: string | null;
  sent_from: string | null;
  amount_minor: number | null;
  status: SubmissionStatus;
  version: number;
  claimed_by: string | null;
  claimed_at: Date | null;
  decided_by: string | null;
  decided_at: Date | null;
  customer_reason: string | null;
  internal_note: string | null;
  created_at: Date;
}): SubmissionRecord => ({
  id: r.id,
  bookingId: r.booking_id,
  methodId: r.method_id,
  fileId: r.file_id,
  txnId: r.txn_id,
  sentFrom: r.sent_from,
  amountMinor: r.amount_minor,
  status: r.status,
  version: r.version,
  claimedBy: r.claimed_by,
  claimedAt: r.claimed_at,
  decidedBy: r.decided_by,
  decidedAt: r.decided_at,
  customerReason: r.customer_reason,
  internalNote: r.internal_note,
  createdAt: r.created_at,
});

/** The only code that touches payment submissions. */
@Injectable()
export class PaymentsRepository {
  async insert(s: {
    bookingId: string;
    methodId: string | null;
    fileId: string;
    txnId: string | null;
    sentFrom: string | null;
    amountMinor: number | null;
  }): Promise<string> {
    const id = admitId("sub");
    await admitDb()
      .insertInto("admit_payment_submissions")
      .values({
        id,
        organization_id: requireOrganizationId(),
        booking_id: s.bookingId,
        method_id: s.methodId,
        file_id: s.fileId,
        txn_id: s.txnId,
        sent_from: s.sentFrom,
        amount_minor: s.amountMinor,
      })
      .execute();
    return id;
  }

  async find(id: string): Promise<SubmissionRecord | undefined> {
    const r = await admitDb()
      .selectFrom("admit_payment_submissions")
      .select([...cols])
      .where("id", "=", id)
      .executeTakeFirst();
    return r ? toSub(r as never) : undefined;
  }
  async lock(id: string): Promise<SubmissionRecord | undefined> {
    const r = await admitDb()
      .selectFrom("admit_payment_submissions")
      .select([...cols])
      .where("id", "=", id)
      .forUpdate()
      .executeTakeFirst();
    return r ? toSub(r as never) : undefined;
  }
  async findByDecisionKey(key: string): Promise<SubmissionRecord | undefined> {
    const r = await admitDb()
      .selectFrom("admit_payment_submissions")
      .select([...cols])
      .where("decision_key", "=", key)
      .executeTakeFirst();
    return r ? toSub(r as never) : undefined;
  }
  async openForBooking(bookingId: string): Promise<SubmissionRecord | undefined> {
    const r = await admitDb()
      .selectFrom("admit_payment_submissions")
      .select([...cols])
      .where("booking_id", "=", bookingId)
      .where("status", "=", "SUBMITTED")
      .executeTakeFirst();
    return r ? toSub(r as never) : undefined;
  }
  async historyForBooking(bookingId: string): Promise<SubmissionRecord[]> {
    return (
      await admitDb()
        .selectFrom("admit_payment_submissions")
        .select([...cols])
        .where("booking_id", "=", bookingId)
        .orderBy("created_at")
        .execute()
    ).map((r) => toSub(r as never));
  }
  async supersedeOpen(bookingId: string): Promise<void> {
    await admitDb()
      .updateTable("admit_payment_submissions")
      .set({ status: "SUPERSEDED", version: sql`version + 1` })
      .where("booking_id", "=", bookingId)
      .where("status", "=", "SUBMITTED")
      .execute();
  }

  /** The review queue: submissions awaiting a decision, oldest first, limited to the caller's events. */
  async queue(eventIds: string[] | null, filter: { eventId?: string; status?: SubmissionStatus[] }): Promise<Array<SubmissionRecord & { eventId: string }>> {
    if (eventIds && !eventIds.length) return [];
    let q = admitDb()
      .selectFrom("admit_payment_submissions as s")
      .innerJoin("admit_bookings as b", (j) => j.onRef("b.id", "=", "s.booking_id").onRef("b.organization_id", "=", "s.organization_id"))
      .select([
        "s.id",
        "s.booking_id",
        "s.method_id",
        "s.file_id",
        "s.txn_id",
        "s.sent_from",
        "s.amount_minor",
        "s.status",
        "s.version",
        "s.claimed_by",
        "s.claimed_at",
        "s.decided_by",
        "s.decided_at",
        "s.customer_reason",
        "s.internal_note",
        "s.created_at",
        "b.event_id",
      ]);
    if (eventIds) q = q.where("b.event_id", "in", eventIds);
    if (filter.eventId) q = q.where("b.event_id", "=", filter.eventId);
    q = q.where("s.status", "in", filter.status?.length ? filter.status : ["SUBMITTED"]);
    const rows = await q.orderBy("s.created_at").limit(200).execute();
    return rows.map((r) => ({ ...toSub(r as never), eventId: r.event_id }));
  }

  /**
   * Soft lock: advisory only (the hard guard is the version check on decide). Succeeds when nobody holds the lock,
   * the previous lock is stale, or the caller already holds it (heartbeat). Returns the holder after the attempt.
   */
  async claim(id: string, userId: string, now: Date, ttlMs: number): Promise<{ claimedBy: string | null; claimedAt: Date | null }> {
    const stale = new Date(now.getTime() - ttlMs);
    await admitDb()
      .updateTable("admit_payment_submissions")
      .set({ claimed_by: userId, claimed_at: now })
      .where("id", "=", id)
      .where("status", "=", "SUBMITTED")
      .where((eb) => eb.or([eb("claimed_by", "is", null), eb("claimed_by", "=", userId), eb("claimed_at", "<", stale)]))
      .execute();
    const r = await admitDb().selectFrom("admit_payment_submissions").select(["claimed_by", "claimed_at"]).where("id", "=", id).executeTakeFirstOrThrow();
    return { claimedBy: r.claimed_by, claimedAt: r.claimed_at };
  }
  async release(id: string, userId: string): Promise<void> {
    await admitDb()
      .updateTable("admit_payment_submissions")
      .set({ claimed_by: null, claimed_at: null })
      .where("id", "=", id)
      .where("claimed_by", "=", userId)
      .execute();
  }

  /** Version-checked decision: only the first writer to see `status = SUBMITTED` at `version` wins. */
  async decide(
    id: string,
    version: number,
    to: "APPROVED" | "REJECTED",
    d: { by: string; at: Date; customerReason: string | null; internalNote: string | null; decisionKey: string | null },
  ): Promise<boolean> {
    const r = await admitDb()
      .updateTable("admit_payment_submissions")
      .set({
        status: to,
        version: sql`version + 1`,
        decided_by: d.by,
        decided_at: d.at,
        customer_reason: d.customerReason,
        internal_note: d.internalNote,
        decision_key: d.decisionKey,
        claimed_by: null,
        claimed_at: null,
      })
      .where("id", "=", id)
      .where("status", "=", "SUBMITTED")
      .where("version", "=", version)
      .executeTakeFirst();
    return Number(r.numUpdatedRows) === 1;
  }
}
