import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { admitDb } from "@admit/admit/db/executor.js";
import { admitId } from "@admit/admit/shared/ids.js";

export type BookingStatus = "AWAITING_PAYMENT" | "IN_REVIEW" | "CONFIRMED" | "REJECTED" | "EXPIRED" | "CANCELLED";

export interface BookingRecord {
  id: string;
  eventId: string;
  ref: string;
  accessHash: string;
  status: BookingStatus;
  customerName: string;
  email: string;
  phone: string;
  totalMinor: number;
  currency: string;
  holdExpiresAt: Date;
  policyAck: boolean;
  rejectionReason: string | null;
  version: number;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
}
export interface BookingLineRecord {
  id: string;
  bookingId: string;
  ticketTypeId: string;
  quantity: number;
  unitPriceMinor: number;
  holderNames: string[];
}
export interface TimelineRecord {
  id: string;
  bookingId: string;
  step: string;
  state: "done" | "pending" | "failed";
  actorId: string | null;
  note: string | null;
  at: Date;
}
export interface NewBooking {
  id: string;
  eventId: string;
  ref: string;
  accessHash: string;
  customerName: string;
  email: string;
  phone: string;
  totalMinor: number;
  currency: string;
  holdExpiresAt: Date;
  policyAck: boolean;
  idempotencyKey: string | null;
}
export interface BookingFilter {
  eventIds: string[] | null;
  eventId?: string;
  status?: BookingStatus[];
  search?: string;
  limit: number;
  offset: number;
}

const toBooking = (r: {
  id: string; event_id: string; ref: string; access_hash: string; status: BookingStatus; customer_name: string; email: string;
  phone: string; total_minor: number; currency: string; hold_expires_at: Date; policy_ack: boolean; rejection_reason: string | null;
  version: number; confirmed_at: Date | null; cancelled_at: Date | null; created_at: Date;
}): BookingRecord => ({
  id: r.id, eventId: r.event_id, ref: r.ref, accessHash: r.access_hash, status: r.status, customerName: r.customer_name, email: r.email,
  phone: r.phone, totalMinor: r.total_minor, currency: r.currency, holdExpiresAt: r.hold_expires_at, policyAck: r.policy_ack,
  rejectionReason: r.rejection_reason, version: r.version, confirmedAt: r.confirmed_at, cancelledAt: r.cancelled_at, createdAt: r.created_at,
});

const cols = [
  "id", "event_id", "ref", "access_hash", "status", "customer_name", "email", "phone", "total_minor", "currency", "hold_expires_at",
  "policy_ack", "rejection_reason", "version", "confirmed_at", "cancelled_at", "created_at",
] as const;

/** The only code that touches bookings, their lines and their timeline. */
@Injectable()
export class BookingsRepository {
  async insert(b: NewBooking): Promise<void> {
    await admitDb()
      .insertInto("admit_bookings")
      .values({
        id: b.id, organization_id: requireOrganizationId(), event_id: b.eventId, ref: b.ref, access_hash: b.accessHash, customer_name: b.customerName,
        email: b.email, phone: b.phone, total_minor: b.totalMinor, currency: b.currency, hold_expires_at: b.holdExpiresAt, policy_ack: b.policyAck,
        idempotency_key: b.idempotencyKey,
      })
      .execute();
  }

  async insertLines(bookingId: string, lines: Array<{ ticketTypeId: string; quantity: number; unitPriceMinor: number; holderNames: string[] }>): Promise<void> {
    await admitDb()
      .insertInto("admit_booking_lines")
      .values(
        lines.map((l) => ({
          id: admitId("bkl"), organization_id: requireOrganizationId(), booking_id: bookingId, ticket_type_id: l.ticketTypeId, quantity: l.quantity,
          unit_price_minor: l.unitPriceMinor, holder_names: JSON.stringify(l.holderNames) as never,
        })),
      )
      .execute();
  }

  async find(id: string): Promise<BookingRecord | undefined> {
    const r = await admitDb().selectFrom("admit_bookings").select([...cols]).where("id", "=", id).executeTakeFirst();
    return r ? toBooking(r as never) : undefined;
  }
  async findByRef(ref: string): Promise<BookingRecord | undefined> {
    const r = await admitDb().selectFrom("admit_bookings").select([...cols]).where("ref", "=", ref).executeTakeFirst();
    return r ? toBooking(r as never) : undefined;
  }
  async findByIdempotencyKey(key: string): Promise<BookingRecord | undefined> {
    const r = await admitDb().selectFrom("admit_bookings").select([...cols]).where("idempotency_key", "=", key).executeTakeFirst();
    return r ? toBooking(r as never) : undefined;
  }
  /** Row lock for a state change: decisions on one booking are serialised. */
  async lock(id: string): Promise<BookingRecord | undefined> {
    const r = await admitDb().selectFrom("admit_bookings").select([...cols]).where("id", "=", id).forUpdate().executeTakeFirst();
    return r ? toBooking(r as never) : undefined;
  }

  async lines(bookingIds: string[]): Promise<BookingLineRecord[]> {
    if (!bookingIds.length) return [];
    const rows = await admitDb().selectFrom("admit_booking_lines").selectAll().where("booking_id", "in", bookingIds).execute();
    return rows.map((r) => ({
      id: r.id, bookingId: r.booking_id, ticketTypeId: r.ticket_type_id, quantity: r.quantity, unitPriceMinor: r.unit_price_minor, holderNames: r.holder_names,
    }));
  }

  /** Move a booking between states; bumps `version`. Returns whether the row was in one of `from` (so a lost race is visible). */
  async transition(
    id: string,
    from: BookingStatus[],
    to: BookingStatus,
    patch: { rejectionReason?: string | null; holdExpiresAt?: Date; confirmedAt?: Date; cancelledAt?: Date } = {},
  ): Promise<boolean> {
    const r = await admitDb()
      .updateTable("admit_bookings")
      .set({
        status: to,
        version: sql`version + 1`,
        ...(patch.rejectionReason !== undefined && { rejection_reason: patch.rejectionReason }),
        ...(patch.holdExpiresAt && { hold_expires_at: patch.holdExpiresAt }),
        ...(patch.confirmedAt && { confirmed_at: patch.confirmedAt }),
        ...(patch.cancelledAt && { cancelled_at: patch.cancelledAt }),
      })
      .where("id", "=", id)
      .where("status", "in", from)
      .executeTakeFirst();
    return Number(r.numUpdatedRows) === 1;
  }

  async list(f: BookingFilter): Promise<{ items: BookingRecord[]; total: number }> {
    if (f.eventIds && !f.eventIds.length) return { items: [], total: 0 };
    let q = admitDb().selectFrom("admit_bookings");
    if (f.eventIds) q = q.where("event_id", "in", f.eventIds);
    if (f.eventId) q = q.where("event_id", "=", f.eventId);
    if (f.status?.length) q = q.where("status", "in", f.status);
    if (f.search) {
      const like = `%${f.search.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
      q = q.where((eb) => eb.or([eb("ref", "ilike", like), eb("customer_name", "ilike", like), eb("email", "ilike", like), eb("phone", "ilike", like)]));
    }
    const total = await q.select(sql<string>`count(*)`.as("n")).executeTakeFirstOrThrow();
    const rows = await q.select([...cols]).orderBy("created_at", "desc").limit(f.limit).offset(f.offset).execute();
    return { items: rows.map((r) => toBooking(r as never)), total: Number(total.n) };
  }

  async byIds(ids: string[]): Promise<BookingRecord[]> {
    if (!ids.length) return [];
    return (await admitDb().selectFrom("admit_bookings").select([...cols]).where("id", "in", ids).execute()).map((r) => toBooking(r as never));
  }

  // ---- timeline -------------------------------------------------------------------------------
  async addTimeline(bookingId: string, step: string, opts: { state?: "done" | "pending" | "failed"; actorId?: string | null; note?: string | null; at?: Date } = {}): Promise<void> {
    await admitDb()
      .insertInto("admit_booking_timeline")
      .values({
        id: admitId("tln"), organization_id: requireOrganizationId(), booking_id: bookingId, step, state: opts.state ?? "done", actor_id: opts.actorId ?? null,
        note: opts.note ?? null, ...(opts.at && { at: opts.at }),
      })
      .execute();
  }
  async timeline(bookingId: string): Promise<TimelineRecord[]> {
    const rows = await admitDb().selectFrom("admit_booking_timeline").selectAll().where("booking_id", "=", bookingId).orderBy("at").orderBy("id").execute();
    return rows.map((r) => ({ id: r.id, bookingId: r.booking_id, step: r.step, state: r.state, actorId: r.actor_id, note: r.note, at: r.at }));
  }

  // ---- expiry (cross-tenant; call on the system connection) -----------------------------------
  /** Organizations that have bookings whose hold has lapsed without proof. */
  async organizationsWithLapsedHolds(now: Date): Promise<string[]> {
    const rows = await admitDb().selectFrom("admit_bookings").select("organization_id").distinct().where("status", "=", "AWAITING_PAYMENT").where("hold_expires_at", "<=", now).execute();
    return rows.map((r) => r.organization_id);
  }
  async lapsedHolds(now: Date, limit: number): Promise<BookingRecord[]> {
    return (
      await admitDb().selectFrom("admit_bookings").select([...cols]).where("status", "=", "AWAITING_PAYMENT").where("hold_expires_at", "<=", now).orderBy("hold_expires_at").limit(limit).forUpdate().skipLocked().execute()
    ).map((r) => toBooking(r as never));
  }
}
