import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { admitDb } from "@admit/admit/db/executor.js";

export type TicketStatus = "VALID" | "USED" | "REVOKED";

export interface TicketRecord {
  id: string;
  bookingId: string;
  eventId: string;
  ticketTypeId: string;
  seq: number;
  holderName: string;
  status: TicketStatus;
  checkedInAt: Date | null;
  checkedInGate: string | null;
  checkedInBy: string | null;
  revokedAt: Date | null;
  revokedReason: string | null;
}

const cols = [
  "id", "booking_id", "event_id", "ticket_type_id", "seq", "holder_name", "status", "checked_in_at", "checked_in_gate", "checked_in_by",
  "revoked_at", "revoked_reason",
] as const;

const toTicket = (r: {
  id: string; booking_id: string; event_id: string; ticket_type_id: string; seq: number; holder_name: string; status: TicketStatus;
  checked_in_at: Date | null; checked_in_gate: string | null; checked_in_by: string | null; revoked_at: Date | null; revoked_reason: string | null;
}): TicketRecord => ({
  id: r.id, bookingId: r.booking_id, eventId: r.event_id, ticketTypeId: r.ticket_type_id, seq: r.seq, holderName: r.holder_name, status: r.status,
  checkedInAt: r.checked_in_at, checkedInGate: r.checked_in_gate, checkedInBy: r.checked_in_by, revokedAt: r.revoked_at, revokedReason: r.revoked_reason,
});

/** The only code that touches issued tickets. Tickets are never deleted. */
@Injectable()
export class TicketsRepository {
  /** Idempotent per booking: `(booking_id, seq)` is unique, so a replayed issuance inserts nothing. Returns how many rows were new. */
  async insertMany(
    rows: Array<{ id: string; bookingId: string; eventId: string; ticketTypeId: string; seq: number; holderName: string; tokenHash: string }>,
  ): Promise<number> {
    if (!rows.length) return 0;
    const res = await admitDb()
      .insertInto("admit_tickets")
      .values(
        rows.map((r) => ({
          id: r.id, organization_id: requireOrganizationId(), booking_id: r.bookingId, event_id: r.eventId, ticket_type_id: r.ticketTypeId, seq: r.seq,
          holder_name: r.holderName, token_hash: r.tokenHash,
        })),
      )
      .onConflict((oc) => oc.columns(["booking_id", "seq"]).doNothing())
      .executeTakeFirst();
    return Number(res.numInsertedOrUpdatedRows ?? 0);
  }

  async forBookings(bookingIds: string[]): Promise<TicketRecord[]> {
    if (!bookingIds.length) return [];
    return (await admitDb().selectFrom("admit_tickets").select([...cols]).where("booking_id", "in", bookingIds).orderBy("booking_id").orderBy("seq").execute()).map(toTicket);
  }
  async find(id: string): Promise<TicketRecord | undefined> {
    const r = await admitDb().selectFrom("admit_tickets").select([...cols]).where("id", "=", id).executeTakeFirst();
    return r ? toTicket(r) : undefined;
  }
  async findByTokenHash(hash: string): Promise<TicketRecord | undefined> {
    const r = await admitDb().selectFrom("admit_tickets").select([...cols]).where("token_hash", "=", hash).executeTakeFirst();
    return r ? toTicket(r) : undefined;
  }

  /**
   * The check-in race, decided by the database: exactly one caller flips VALID -> USED, because the UPDATE re-checks
   * the status under the row lock. Anyone who loses gets no row back.
   */
  async admit(id: string, eventId: string, at: Date, gate: string, staffId: string): Promise<TicketRecord | undefined> {
    const r = await admitDb()
      .updateTable("admit_tickets")
      .set({ status: "USED", checked_in_at: at, checked_in_gate: gate, checked_in_by: staffId })
      .where("id", "=", id)
      .where("event_id", "=", eventId)
      .where("status", "=", "VALID")
      .returning([...cols])
      .executeTakeFirst();
    return r ? toTicket(r) : undefined;
  }

  async revoke(id: string, at: Date, by: string, reason: string): Promise<boolean> {
    const r = await admitDb()
      .updateTable("admit_tickets")
      .set({ status: "REVOKED", revoked_at: at, revoked_by: by, revoked_reason: reason })
      .where("id", "=", id)
      .where("status", "!=", "REVOKED")
      .executeTakeFirst();
    return Number(r.numUpdatedRows) === 1;
  }
  async revokeForBooking(bookingId: string, at: Date, by: string | null, reason: string): Promise<number> {
    const r = await admitDb()
      .updateTable("admit_tickets")
      .set({ status: "REVOKED", revoked_at: at, revoked_by: by, revoked_reason: reason })
      .where("booking_id", "=", bookingId)
      .where("status", "=", "VALID")
      .executeTakeFirst();
    return Number(r.numUpdatedRows);
  }

  async search(opts: { eventIds: string[] | null; eventId?: string; q?: string; limit: number; offset: number }): Promise<TicketRecord[]> {
    if (opts.eventIds && !opts.eventIds.length) return [];
    let q = admitDb().selectFrom("admit_tickets").select([...cols]);
    if (opts.eventIds) q = q.where("event_id", "in", opts.eventIds);
    if (opts.eventId) q = q.where("event_id", "=", opts.eventId);
    if (opts.q) {
      const like = `%${opts.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
      q = q.where((eb) => eb.or([eb("holder_name", "ilike", like), eb("id", "ilike", like)]));
    }
    return (await q.orderBy("created_at", "desc").limit(opts.limit).offset(opts.offset).execute()).map(toTicket);
  }

  // ---- check-in aggregates --------------------------------------------------------------------
  async countsByStatus(eventId: string): Promise<Record<TicketStatus, number>> {
    const rows = await admitDb().selectFrom("admit_tickets").select(["status", sql<string>`count(*)`.as("n")]).where("event_id", "=", eventId).groupBy("status").execute();
    const out: Record<TicketStatus, number> = { VALID: 0, USED: 0, REVOKED: 0 };
    for (const r of rows) out[r.status] = Number(r.n);
    return out;
  }
  async countsByType(eventId: string): Promise<Array<{ ticketTypeId: string; total: number; used: number }>> {
    const rows = await admitDb()
      .selectFrom("admit_tickets")
      .select(["ticket_type_id", sql<string>`count(*) filter (where status <> 'REVOKED')`.as("total"), sql<string>`count(*) filter (where status = 'USED')`.as("used")])
      .where("event_id", "=", eventId)
      .groupBy("ticket_type_id")
      .execute();
    return rows.map((r) => ({ ticketTypeId: r.ticket_type_id, total: Number(r.total), used: Number(r.used) }));
  }
  async arrivals(eventId: string, bucketMinutes = 15): Promise<Array<{ at: Date; n: number }>> {
    const rows = await admitDb()
      .selectFrom("admit_tickets")
      .select([
        sql<Date>`to_timestamp(floor(extract(epoch from checked_in_at) / ${bucketMinutes * 60}) * ${bucketMinutes * 60})`.as("bucket"),
        sql<string>`count(*)`.as("n"),
      ])
      .where("event_id", "=", eventId)
      .where("status", "=", "USED")
      .groupBy("bucket")
      .orderBy("bucket")
      .execute();
    return rows.map((r) => ({ at: new Date(r.bucket), n: Number(r.n) }));
  }
}
