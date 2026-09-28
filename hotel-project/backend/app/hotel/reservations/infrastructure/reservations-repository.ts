import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { hotelDb } from "@hotel/hotel/db/executor.js";
import { hotelId } from "@hotel/hotel/shared/ids.js";
import type { IsoDate } from "@hotel/hotel/shared/dates.js";
import { moneyNumber, moneyString } from "@hotel/hotel/shared/money.js";
import type { NightPrice } from "@hotel/hotel/pricing/domain/pricing.js";
import type { ReservationStatus } from "../domain/reservation-state.js";

export type ReservationSource =
  "direct" | "phone" | "walk_in" | "website" | "booking_com" | "expedia";

export interface ReservationRecord {
  id: string;
  code: string;
  status: ReservationStatus;
  source: ReservationSource;
  guestId: string;
  guestName: string;
  guestPhone: string | null;
  guestVip: boolean;
  roomTypeId: string;
  roomTypeName: string;
  roomId: string | null;
  roomNumber: string | null;
  arrival: IsoDate;
  departure: IsoDate;
  nights: number;
  adults: number;
  children: number;
  nightlyRates: NightPrice[];
  roomTotal: number;
  discountCode: string | null;
  discountAmount: number;
  total: number;
  notes: string | null;
  cancellationReason: string | null;
  createdAt: Date;
}

export interface NewReservation {
  code: string;
  guestId: string;
  roomTypeId: string;
  status: ReservationStatus;
  source: ReservationSource;
  arrival: IsoDate;
  departure: IsoDate;
  adults: number;
  children: number;
  nightlyRates: NightPrice[];
  roomTotal: number;
  discountCode: string | null;
  discountAmount: number;
  total: number;
  notes: string | null;
  createdBy: string;
  createdAt: Date;
}

export interface ReservationFilter {
  status?: ReservationStatus;
  /** Arrivals on this date. */
  arrivalOn?: IsoDate;
  /** Departures on this date. */
  departureOn?: IsoDate;
  guestId?: string;
  q?: string;
  page: number;
  pageSize: number;
}

export interface StatusHistoryEntry {
  fromStatus: ReservationStatus | null;
  toStatus: ReservationStatus;
  actorId: string | null;
  reason: string | null;
  at: Date;
}

export interface CandidateRoom {
  id: string;
  number: string;
}

const text = (ref: string) => sql<string>`${sql.ref(ref)}::text`;

/**
 * Reservations, their status history, and the room-allocation ledger. Allocation writes go
 * through here only; the exclusion constraint on `hotel_room_allocations` is what guarantees no
 * two active claims on a room overlap — this repository never "checks then writes".
 */
@Injectable()
export class ReservationsRepository {
  private org() {
    return requireOrganizationId();
  }

  /** BK-1001, BK-1002, … per hotel. The upsert's row lock serialises concurrent bookings. */
  async nextCode(): Promise<string> {
    const row = await hotelDb()
      .insertInto("hotel_counters")
      .values({ organization_id: this.org(), name: "reservation", value: "1001" })
      .onConflict((oc) =>
        oc.columns(["organization_id", "name"]).doUpdateSet({
          value: sql`hotel_counters.value + 1`,
        }),
      )
      .returning("value")
      .executeTakeFirstOrThrow();
    return `BK-${row.value}`;
  }

  async insert(r: NewReservation): Promise<string> {
    const id = hotelId("rsv");
    await hotelDb()
      .insertInto("hotel_reservations")
      .values({
        id,
        organization_id: this.org(),
        code: r.code,
        guest_id: r.guestId,
        room_type_id: r.roomTypeId,
        status: r.status,
        source: r.source,
        arrival: r.arrival,
        departure: r.departure,
        adults: r.adults,
        children: r.children,
        nightly_rates: JSON.stringify(r.nightlyRates),
        room_total: moneyString(r.roomTotal),
        discount_code: r.discountCode,
        discount_amount: moneyString(r.discountAmount),
        total: moneyString(r.total),
        notes: r.notes,
        created_by: r.createdBy,
        created_at: r.createdAt,
      })
      .execute();
    return id;
  }

  private base() {
    const org = this.org();
    return hotelDb()
      .selectFrom("hotel_reservations as r")
      .innerJoin("hotel_guests as g", (j) =>
        j.onRef("g.id", "=", "r.guest_id").onRef("g.organization_id", "=", "r.organization_id"),
      )
      .innerJoin("hotel_room_types as t", (j) =>
        j.onRef("t.id", "=", "r.room_type_id").onRef("t.organization_id", "=", "r.organization_id"),
      )
      .leftJoin("hotel_room_allocations as a", (j) =>
        j
          .onRef("a.reservation_id", "=", "r.id")
          .on("a.organization_id", "=", org)
          .on("a.kind", "=", "reservation"),
      )
      .leftJoin("hotel_rooms as rm", (j) =>
        j.onRef("rm.id", "=", "a.room_id").on("rm.organization_id", "=", org),
      )
      .where("r.organization_id", "=", org)
      .select([
        "r.id",
        "r.code",
        "r.status",
        "r.source",
        "r.guest_id",
        "g.full_name as guest_name",
        "g.phone as guest_phone",
        "g.vip as guest_vip",
        "r.room_type_id",
        "t.name as room_type_name",
        "a.room_id",
        "rm.number as room_number",
        text("r.arrival").as("arrival"),
        text("r.departure").as("departure"),
        "r.adults",
        "r.children",
        "r.nightly_rates",
        "r.room_total",
        "r.discount_code",
        "r.discount_amount",
        "r.total",
        "r.notes",
        "r.cancellation_reason",
        "r.created_at",
      ]);
  }

  async findById(id: string): Promise<ReservationRecord | null> {
    const row = await this.base().where("r.id", "=", id).executeTakeFirst();
    return row ? this.toRecord(row) : null;
  }

  async findByIds(ids: string[]): Promise<ReservationRecord[]> {
    if (ids.length === 0) return [];
    const rows = await this.base().where("r.id", "in", ids).execute();
    return rows.map((r) => this.toRecord(r));
  }

  /** Confirmed bookings whose arrival night has passed with no check-in (no-show candidates). */
  async overdueArrivals(today: IsoDate): Promise<string[]> {
    const rows = await hotelDb()
      .selectFrom("hotel_reservations")
      .select("id")
      .where("organization_id", "=", this.org())
      .where("status", "=", "confirmed")
      .where(sql<boolean>`arrival < ${today}::date`)
      .orderBy("arrival")
      .execute();
    return rows.map((r) => r.id);
  }

  /** Unconfirmed holds not confirmed in time, or whose arrival night has already passed. */
  async expiredHolds(createdBefore: Date, today: IsoDate): Promise<string[]> {
    const rows = await hotelDb()
      .selectFrom("hotel_reservations")
      .select("id")
      .where("organization_id", "=", this.org())
      .where("status", "=", "pending")
      .where(sql<boolean>`(created_at < ${createdBefore} OR arrival < ${today}::date)`)
      .orderBy("created_at")
      .execute();
    return rows.map((r) => r.id);
  }

  /** Row-locks the reservation for the rest of the transaction (serialises state changes). */
  async lock(id: string): Promise<boolean> {
    const row = await hotelDb()
      .selectFrom("hotel_reservations")
      .select("id")
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .forUpdate()
      .executeTakeFirst();
    return Boolean(row);
  }

  async list(filter: ReservationFilter): Promise<{ items: ReservationRecord[]; total: number }> {
    let q = this.base();
    if (filter.status) q = q.where("r.status", "=", filter.status);
    if (filter.arrivalOn) q = q.where(sql<boolean>`r.arrival = ${filter.arrivalOn}::date`);
    if (filter.departureOn) q = q.where(sql<boolean>`r.departure = ${filter.departureOn}::date`);
    if (filter.guestId) q = q.where("r.guest_id", "=", filter.guestId);
    const term = filter.q?.trim();
    if (term) {
      const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      q = q.where((eb) =>
        eb.or([
          eb("g.full_name", "ilike", like),
          eb("r.code", "ilike", like),
          eb("rm.number", "=", term),
        ]),
      );
    }
    const count = await q
      .clearSelect()
      .select((eb) => eb.fn.countAll<string>().as("n"))
      .executeTakeFirstOrThrow();
    const rows = await q
      .orderBy("r.arrival", "desc")
      .orderBy("r.code", "desc")
      .limit(filter.pageSize)
      .offset((filter.page - 1) * filter.pageSize)
      .execute();
    return { items: rows.map((r) => this.toRecord(r)), total: Number(count.n) };
  }

  async setStatus(
    id: string,
    status: ReservationStatus,
    at: Date,
    extra: { cancellationReason?: string | null } = {},
  ): Promise<void> {
    const stamp =
      status === "confirmed"
        ? { confirmed_at: at }
        : status === "checked_in"
          ? { checked_in_at: at }
          : status === "checked_out"
            ? { checked_out_at: at }
            : status === "cancelled"
              ? { cancelled_at: at, cancellation_reason: extra.cancellationReason ?? null }
              : {};
    await hotelDb()
      .updateTable("hotel_reservations")
      .set({ status, ...stamp })
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .execute();
  }

  async updateStayAndPrice(
    id: string,
    v: {
      arrival: IsoDate;
      departure: IsoDate;
      nightlyRates: NightPrice[];
      roomTotal: number;
      discountAmount: number;
      total: number;
    },
  ): Promise<void> {
    await hotelDb()
      .updateTable("hotel_reservations")
      .set({
        arrival: v.arrival,
        departure: v.departure,
        nightly_rates: JSON.stringify(v.nightlyRates),
        room_total: moneyString(v.roomTotal),
        discount_amount: moneyString(v.discountAmount),
        total: moneyString(v.total),
      })
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .execute();
  }

  async addHistory(
    reservationId: string,
    from: ReservationStatus | null,
    to: ReservationStatus,
    actorId: string | null,
    reason: string | null = null,
  ): Promise<void> {
    await hotelDb()
      .insertInto("hotel_reservation_status_history")
      .values({
        id: hotelId("rsh"),
        organization_id: this.org(),
        reservation_id: reservationId,
        from_status: from,
        to_status: to,
        actor_id: actorId,
        reason,
      })
      .execute();
  }

  async history(reservationId: string): Promise<StatusHistoryEntry[]> {
    const rows = await hotelDb()
      .selectFrom("hotel_reservation_status_history")
      .select(["from_status", "to_status", "actor_id", "reason", "created_at"])
      .where("organization_id", "=", this.org())
      .where("reservation_id", "=", reservationId)
      .orderBy("seq")
      .execute();
    return rows.map((r) => ({
      fromStatus: r.from_status as ReservationStatus | null,
      toStatus: r.to_status as ReservationStatus,
      actorId: r.actor_id,
      reason: r.reason,
      at: r.created_at,
    }));
  }

  // ─── allocation ledger ─────────────────────────────────────────────────────

  /** Claim `roomId` for [arrival, departure). Throws the raw 23P01 if the nights are taken. */
  async allocate(
    roomId: string,
    reservationId: string,
    arrival: IsoDate,
    departure: IsoDate,
  ): Promise<void> {
    await sql`
      INSERT INTO hotel_room_allocations (id, organization_id, room_id, kind, reservation_id, stay)
      VALUES (${hotelId("ral")}, ${this.org()}, ${roomId}, 'reservation', ${reservationId},
              daterange(${arrival}::date, ${departure}::date, '[)'))
    `.execute(hotelDb());
  }

  /** Release every active claim of a reservation (cancel / no-show). */
  async release(reservationId: string): Promise<void> {
    await hotelDb()
      .updateTable("hotel_room_allocations")
      .set({ active: false })
      .where("organization_id", "=", this.org())
      .where("reservation_id", "=", reservationId)
      .where("active", "=", true)
      .execute();
  }

  /** Move the stay to another room, or to new dates, in place. Raw 23P01 on conflict. */
  async reallocate(
    reservationId: string,
    v: { roomId: string; arrival: IsoDate; departure: IsoDate },
  ): Promise<void> {
    await sql`
      UPDATE hotel_room_allocations
         SET room_id = ${v.roomId},
             stay = daterange(${v.arrival}::date, ${v.departure}::date, '[)')
       WHERE organization_id = ${this.org()}
         AND reservation_id = ${reservationId}
         AND active
    `.execute(hotelDb());
  }

  /** Early check-out: the stay's claim now ends on `newEnd` (the unused nights are released). */
  async shrinkStay(reservationId: string, newEnd: IsoDate): Promise<void> {
    await sql`
      UPDATE hotel_room_allocations
         SET stay = daterange(lower(stay), ${newEnd}::date, '[)')
       WHERE organization_id = ${this.org()}
         AND reservation_id = ${reservationId}
         AND active
    `.execute(hotelDb());
  }

  /**
   * Front-desk lists for the business date: arrivals still to check in (due today, or overdue
   * and not yet marked no-show), guests due out today or earlier, and everyone in house.
   */
  async frontDesk(today: IsoDate): Promise<{
    arrivals: ReservationRecord[];
    departures: ReservationRecord[];
    inHouse: ReservationRecord[];
  }> {
    const [arrivals, inHouse] = await Promise.all([
      this.base()
        .where("r.status", "in", ["confirmed", "pending"])
        .where(sql<boolean>`r.arrival <= ${today}::date AND r.departure > ${today}::date`)
        .orderBy("r.arrival")
        .orderBy("g.full_name")
        .execute(),
      this.base().where("r.status", "=", "checked_in").orderBy("rm.number").execute(),
    ]);
    const inHouseRecords = inHouse.map((x) => this.toRecord(x));
    return {
      arrivals: arrivals.map((x) => this.toRecord(x)),
      departures: inHouseRecords.filter((x) => x.departure <= today),
      inHouse: inHouseRecords,
    };
  }

  /**
   * Rooms of a type that are sellable for the whole stay: not archived, with no active allocation
   * (stay OR maintenance block) overlapping. A room's CURRENT service status is deliberately not
   * consulted: blocks in the ledger cover exactly the nights it can't be sold. Only a starting point for allocation — the exclusion
   * constraint decides; a room can still be taken by a concurrent transaction in between.
   */
  async candidateRooms(
    roomTypeId: string,
    arrival: IsoDate,
    departure: IsoDate,
    excludeReservationId?: string,
  ): Promise<CandidateRoom[]> {
    const org = this.org();
    const rows = await sql<CandidateRoom>`
      SELECT r.id, r.number
        FROM hotel_rooms r
       WHERE r.organization_id = ${org}
         AND r.room_type_id = ${roomTypeId}
         AND r.archived_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM hotel_room_allocations a
            WHERE a.organization_id = ${org}
              AND a.room_id = r.id
              AND a.active
              AND a.stay && daterange(${arrival}::date, ${departure}::date, '[)')
              -- Blocks (reservation_id NULL) always count; only the stay being moved is ignored.
              AND (a.reservation_id IS NULL
                   OR a.reservation_id IS DISTINCT FROM ${excludeReservationId ?? null})
         )
       ORDER BY r.floor, length(r.number), r.number
    `.execute(hotelDb());
    return rows.rows;
  }

  /** Free rooms per room type for a stay (same sellability rule as `candidateRooms`). */
  async availabilityByType(arrival: IsoDate, departure: IsoDate): Promise<Map<string, number>> {
    const org = this.org();
    const rows = await sql<{ room_type_id: string; free: number }>`
      SELECT r.room_type_id, count(*)::int AS free
        FROM hotel_rooms r
       WHERE r.organization_id = ${org}
         AND r.archived_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM hotel_room_allocations a
            WHERE a.organization_id = ${org}
              AND a.room_id = r.id
              AND a.active
              AND a.stay && daterange(${arrival}::date, ${departure}::date, '[)')
         )
       GROUP BY r.room_type_id
    `.execute(hotelDb());
    return new Map(rows.rows.map((r) => [r.room_type_id, r.free]));
  }

  /** Active allocations overlapping [from, to), with reservation details, for the calendar. */
  async allocationsBetween(from: IsoDate, to: IsoDate) {
    const org = this.org();
    const rows = await sql<{
      room_id: string;
      kind: "reservation" | "block";
      start: string;
      end: string;
      reason: string | null;
      reservation_id: string | null;
      code: string | null;
      status: ReservationStatus | null;
      guest_name: string | null;
    }>`
      SELECT a.room_id, a.kind, lower(a.stay)::text AS start, upper(a.stay)::text AS "end",
             COALESCE(mt.number || ' · ' || mt.title, a.reason) AS reason,
             r.id AS reservation_id, r.code, r.status, g.full_name AS guest_name
        FROM hotel_room_allocations a
        LEFT JOIN hotel_reservations r ON r.organization_id = a.organization_id AND r.id = a.reservation_id
        LEFT JOIN hotel_guests g ON g.organization_id = r.organization_id AND g.id = r.guest_id
        LEFT JOIN hotel_maintenance_tickets mt ON mt.organization_id = a.organization_id AND mt.id = a.ticket_id
       WHERE a.organization_id = ${org}
         AND a.active
         AND a.stay && daterange(${from}::date, ${to}::date, '[)')
       ORDER BY lower(a.stay)
    `.execute(hotelDb());
    return rows.rows;
  }

  // ─── maintenance blocks (same ledger, same exclusion constraint) ──────────

  /** Take a room's nights out of sale for a ticket. Raw 23P01 if any stay overlaps. */
  async insertBlock(roomId: string, ticketId: string, from: IsoDate, to: IsoDate): Promise<void> {
    await sql`
      INSERT INTO hotel_room_allocations (id, organization_id, room_id, kind, ticket_id, stay)
      VALUES (${hotelId("ral")}, ${this.org()}, ${roomId}, 'block', ${ticketId},
              daterange(${from}::date, ${to}::date, '[)'))
    `.execute(hotelDb());
  }

  /** Move a ticket's block end date. Raw 23P01 if the new nights are booked. */
  async extendBlock(ticketId: string, to: IsoDate): Promise<void> {
    await sql`
      UPDATE hotel_room_allocations
         SET stay = daterange(lower(stay), ${to}::date, '[)')
       WHERE organization_id = ${this.org()} AND ticket_id = ${ticketId} AND active
    `.execute(hotelDb());
  }

  /**
   * End a ticket's block today: nights already past stay on record, the rest return to sale.
   * A block that hasn't started yet is simply released.
   */
  async releaseBlock(ticketId: string, today: IsoDate): Promise<void> {
    await sql`
      UPDATE hotel_room_allocations
         SET active = lower(stay) < ${today}::date,
             stay = CASE WHEN lower(stay) < ${today}::date
                         THEN daterange(lower(stay), LEAST(upper(stay), ${today}::date), '[)')
                         ELSE stay END
       WHERE organization_id = ${this.org()} AND ticket_id = ${ticketId} AND active
    `.execute(hotelDb());
  }

  /** Reservation codes whose active stays on a room overlap [from, to) — for a helpful conflict. */
  async overlappingStays(roomId: string, from: IsoDate, to: IsoDate): Promise<string[]> {
    const rows = await sql<{ code: string }>`
      SELECT r.code
        FROM hotel_room_allocations a
        JOIN hotel_reservations r ON r.organization_id = a.organization_id AND r.id = a.reservation_id
       WHERE a.organization_id = ${this.org()}
         AND a.room_id = ${roomId}
         AND a.active
         AND a.stay && daterange(${from}::date, ${to}::date, '[)')
       ORDER BY lower(a.stay)
    `.execute(hotelDb());
    return rows.rows.map((r) => r.code);
  }

  /** The strongest active block impact covering `day` on a room, if any. */
  async blockImpactOn(
    roomId: string,
    day: IsoDate,
  ): Promise<"maintenance" | "out_of_service" | null> {
    const rows = await sql<{ room_impact: "maintenance" | "out_of_service" }>`
      SELECT mt.room_impact
        FROM hotel_room_allocations a
        JOIN hotel_maintenance_tickets mt ON mt.organization_id = a.organization_id AND mt.id = a.ticket_id
       WHERE a.organization_id = ${this.org()}
         AND a.room_id = ${roomId}
         AND a.kind = 'block'
         AND a.active
         AND a.stay @> ${day}::date
    `.execute(hotelDb());
    const impacts = rows.rows.map((r) => r.room_impact);
    if (impacts.includes("out_of_service")) return "out_of_service";
    if (impacts.includes("maintenance")) return "maintenance";
    return null;
  }

  private toRecord(r: {
    id: string;
    code: string;
    status: ReservationStatus;
    source: ReservationSource;
    guest_id: string;
    guest_name: string;
    guest_phone: string | null;
    guest_vip: boolean;
    room_type_id: string;
    room_type_name: string;
    room_id: string | null;
    room_number: string | null;
    arrival: string;
    departure: string;
    adults: number;
    children: number;
    nightly_rates: NightPrice[];
    room_total: string;
    discount_code: string | null;
    discount_amount: string;
    total: string;
    notes: string | null;
    cancellation_reason: string | null;
    created_at: Date;
  }): ReservationRecord {
    return {
      id: r.id,
      code: r.code,
      status: r.status,
      source: r.source,
      guestId: r.guest_id,
      guestName: r.guest_name,
      guestPhone: r.guest_phone,
      guestVip: r.guest_vip,
      roomTypeId: r.room_type_id,
      roomTypeName: r.room_type_name,
      roomId: r.room_id,
      roomNumber: r.room_number,
      arrival: r.arrival,
      departure: r.departure,
      nights: r.nightly_rates.length,
      adults: r.adults,
      children: r.children,
      nightlyRates: r.nightly_rates,
      roomTotal: moneyNumber(r.room_total),
      discountCode: r.discount_code,
      discountAmount: moneyNumber(r.discount_amount),
      total: moneyNumber(r.total),
      notes: r.notes,
      cancellationReason: r.cancellation_reason,
      createdAt: r.created_at,
    };
  }
}
