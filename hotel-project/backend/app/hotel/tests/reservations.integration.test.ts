/**
 * Slice 2 — the reservation engine. The no-double-booking invariant is tested three ways:
 * directly against the database (the exclusion constraint alone), through the service, and under
 * real concurrency (many transactions racing for the same inventory). The concurrency tests are
 * the slice's acceptance criterion.
 */
import pg from "pg";
import { sql } from "kysely";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { TestingModule } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@core/kernel/clock.js";
import { TEST_DATABASE_URL } from "@core/tests/helpers.js";
import { EventRegistry } from "@core/events/registry.js";
import type { DomainEvent } from "@core/contracts/index.js";
import { hotelDb } from "@hotel/hotel/db/executor.js";
import { RoomTypesService } from "@hotel/hotel/rooms/application/room-types-service.js";
import { RoomsService } from "@hotel/hotel/rooms/application/rooms-service.js";
import { GuestsService } from "@hotel/hotel/guests/application/guests-service.js";
import { PricingService } from "@hotel/hotel/pricing/application/pricing-service.js";
import {
  ReservationsService,
  type CreateReservationInput,
} from "@hotel/hotel/reservations/application/reservations-service.js";
import { AvailabilityService } from "@hotel/hotel/reservations/application/availability-service.js";
import {
  asUser,
  createHotelHttpTestApp,
  get,
  hasTestDb,
  loginAs,
  seedHotel,
  seedStaff,
  type SeededHotel,
} from "./helpers.js";

// "Today" at the hotel is 2026-10-01 (a Thursday) — 08:00 UTC is 11:00 in Cairo.
const TODAY = "2026-10-01";
const clock = fixedClock("2026-10-01T08:00:00.000Z");

interface Fixture {
  hotel: SeededHotel;
  typeId: string;
  roomIds: string[];
  guestId: string;
}

async function ownerQuery<T extends pg.QueryResultRow>(text: string, params: unknown[] = []) {
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    return (await client.query<T>(text, params)).rows;
  } finally {
    await client.end();
  }
}

/** Overlapping ACTIVE allocations on the same room — must always be zero. */
async function overlappingAllocations(): Promise<number> {
  const rows = await ownerQuery<{ n: string }>(
    `SELECT count(*)::text AS n
       FROM hotel_room_allocations a
       JOIN hotel_room_allocations b
         ON a.organization_id = b.organization_id AND a.room_id = b.room_id
        AND a.id < b.id AND a.stay && b.stay
      WHERE a.active AND b.active`,
  );
  return Number(rows[0]!.n);
}

describe.skipIf(!hasTestDb)("HotelOS reservation engine (Slice 2)", () => {
  let app: TestingModule;
  let http: NestFastifyApplication;
  const events: DomainEvent[] = [];

  const reservations = () => get<ReservationsService>(app, ReservationsService);
  const availability = () => get<AvailabilityService>(app, AvailabilityService);

  async function fixture(name: string, rooms: number, baseRate = 5000): Promise<Fixture> {
    const hotel = await seedHotel(app, name);
    return asUser(hotel.ownerId, hotel.orgId, async () => {
      const type = await get<RoomTypesService>(app, RoomTypesService).create(
        {
          code: "DLX",
          name: "Grand Deluxe Room",
          capacity: 2,
          beds: "1 King bed",
          baseRate,
          amenities: [],
          sortOrder: 0,
        },
        hotel.ownerId,
      );
      const roomIds: string[] = [];
      for (let i = 1; i <= rooms; i++) {
        const room = await get<RoomsService>(app, RoomsService).create(
          { number: `30${i}`, floor: 3, roomTypeId: type.id },
          hotel.ownerId,
        );
        roomIds.push(room.id);
      }
      const guest = await get<GuestsService>(app, GuestsService).create(
        {
          fullName: "Karim Fathy",
          phone: "+20 111 456 7890",
          email: null,
          nationality: "EG",
          idDocumentType: null,
          idDocumentNumber: null,
          preferences: null,
          vip: false,
        },
        hotel.ownerId,
      );
      return { hotel, typeId: type.id, roomIds, guestId: guest.id };
    });
  }

  function book(f: Fixture, over: Partial<CreateReservationInput> = {}) {
    return asUser(f.hotel.ownerId, f.hotel.orgId, () =>
      reservations().create(
        {
          guestId: f.guestId,
          roomTypeId: f.typeId,
          arrival: "2026-10-05",
          departure: "2026-10-08",
          adults: 2,
          children: 0,
          source: "phone",
          ...over,
        },
        f.hotel.ownerId,
      ),
    );
  }

  beforeAll(async () => {
    const booted = await createHotelHttpTestApp({ clock });
    app = booted.moduleRef;
    http = booted.http;
    const registry = get<EventRegistry>(app, EventRegistry);
    for (const name of [
      "reservation.created",
      "reservation.confirmed",
      "reservation.cancelled",
      "reservation.no_show",
      "reservation.changed",
    ]) {
      registry.onInProcess(name, async (e) => {
        events.push(e);
      });
    }
  }, 120_000);

  afterAll(async () => {
    await http?.close();
  });

  describe("the database guard on its own", () => {
    it("rejects an overlapping active allocation even when inserted directly, bypassing the app", async () => {
      const f = await fixture("Guard Hotel", 1);
      const r = await book(f, { roomId: f.roomIds[0] });
      await expect(
        asUser(f.hotel.ownerId, f.hotel.orgId, () =>
          sql`INSERT INTO hotel_room_allocations (id, organization_id, room_id, kind, reservation_id, stay)
              VALUES ('ral_manual', ${f.hotel.orgId}, ${f.roomIds[0]}, 'reservation', ${r.id},
                      daterange('2026-10-07', '2026-10-09', '[)'))`.execute(hotelDb()),
        ),
      ).rejects.toMatchObject({ code: "23P01" });
    });

    it("lets a departure and the next arrival share a day (half-open stays)", async () => {
      const f = await fixture("Turnover Hotel", 1);
      await book(f, { roomId: f.roomIds[0], arrival: "2026-10-05", departure: "2026-10-08" });
      await expect(
        book(f, { roomId: f.roomIds[0], arrival: "2026-10-08", departure: "2026-10-10" }),
      ).resolves.toMatchObject({ roomId: f.roomIds[0] });
    });
  });

  describe("creating reservations", () => {
    it("assigns a room, prices every night server-side and starts pending with history", async () => {
      const f = await fixture("Create Hotel", 2, 5400);
      const r = await book(f);
      expect(r).toMatchObject({
        code: "BK-1001",
        status: "pending",
        roomTypeName: "Grand Deluxe Room",
        nights: 3,
        roomTotal: 16200,
        total: 16200,
      });
      expect(r.roomId).not.toBeNull();
      const detail = await asUser(f.hotel.ownerId, f.hotel.orgId, () => reservations().get(r.id));
      expect(detail.history).toEqual([
        expect.objectContaining({
          fromStatus: null,
          toStatus: "pending",
          actorName: "Hotel Owner",
        }),
      ]);
      expect(detail.commands).toEqual(["confirm", "cancel"]);
      const second = await book(f);
      expect(second.code).toBe("BK-1002");
      expect(second.roomId).not.toBe(r.roomId);
    });

    it("applies rate rules and discount codes from the pricing module", async () => {
      const f = await fixture("Pricing Hotel", 1, 5000);
      await asUser(f.hotel.ownerId, f.hotel.orgId, async () => {
        const pricing = get<PricingService>(app, PricingService);
        await pricing.createRule(
          {
            name: "Weekend",
            kind: "weekend",
            roomTypeId: null,
            startDate: null,
            endDate: null,
            daysOfWeek: [4, 5],
            adjustmentType: "percent",
            adjustmentValue: 20,
            minNights: null,
            priority: 1,
          },
          f.hotel.ownerId,
        );
        await pricing.createDiscount(
          { code: "NILE10", description: null, percentOff: 10, validFrom: null, validTo: null },
          f.hotel.ownerId,
        );
      });
      // Wed 7 → Sat 10: Wed 5000, Thu 6000, Fri 6000 = 17000, minus 10% = 15300.
      const r = await book(f, {
        arrival: "2026-10-07",
        departure: "2026-10-10",
        discountCode: "nile10",
      });
      expect(r).toMatchObject({
        roomTotal: 17000,
        discountAmount: 1700,
        total: 15300,
        discountCode: "NILE10",
      });
      expect(r.nightlyRates.map((n) => n.rule)).toEqual([null, "Weekend", "Weekend"]);
    });

    it("refuses past arrivals, over-capacity stays and unknown discount codes", async () => {
      const f = await fixture("Rules Hotel", 1);
      await expect(
        book(f, { arrival: "2026-09-29", departure: "2026-10-02" }),
      ).rejects.toMatchObject({
        code: "reservation.arrival_in_past",
      });
      await expect(book(f, { adults: 2, children: 1 })).rejects.toMatchObject({
        code: "reservation.over_capacity",
      });
      await expect(book(f, { discountCode: "NOPE" })).rejects.toMatchObject({
        code: "pricing.unknown_discount",
      });
    });

    it("names the conflict when a specific room is taken, and reports sold-out types", async () => {
      const f = await fixture("Full Hotel", 1);
      await book(f, { roomId: f.roomIds[0] });
      await expect(book(f, { roomId: f.roomIds[0], arrival: "2026-10-06" })).rejects.toMatchObject({
        code: "reservation.room_unavailable",
      });
      await expect(
        book(f, { arrival: "2026-10-06", departure: "2026-10-07" }),
      ).rejects.toMatchObject({
        code: "reservation.no_availability",
      });
    });
  });

  describe("lifecycle", () => {
    it("confirms, then cancels — releasing the room for someone else", async () => {
      const f = await fixture("Lifecycle Hotel", 1);
      const r = await book(f, { confirm: true });
      expect(r.status).toBe("confirmed");
      const cancelled = await asUser(f.hotel.ownerId, f.hotel.orgId, () =>
        reservations().cancel(r.id, "Guest changed plans", f.hotel.ownerId),
      );
      expect(cancelled).toMatchObject({
        status: "cancelled",
        cancellationReason: "Guest changed plans",
      });
      await expect(book(f)).resolves.toMatchObject({ roomId: f.roomIds[0] });

      const detail = await asUser(f.hotel.ownerId, f.hotel.orgId, () => reservations().get(r.id));
      expect(detail.history.map((h) => h.toStatus)).toEqual(["pending", "confirmed", "cancelled"]);
      expect(detail.commands).toEqual([]);
      // created + confirmed share one transaction (same timestamp), so compare as a set.
      const audit = await ownerQuery<{ action: string }>(
        `SELECT action FROM audit_logs WHERE resource_id = $1`,
        [r.id],
      );
      expect(audit.map((a) => a.action).sort()).toEqual([
        "hotel.reservation.cancelled",
        "hotel.reservation.confirmed",
        "hotel.reservation.created",
      ]);
      const mine = events.filter((e) => e.payload.reservationId === r.id).map((e) => e.name);
      expect(mine).toEqual([
        "reservation.created",
        "reservation.confirmed",
        "reservation.cancelled",
      ]);
    });

    it("rejects illegal transitions server-side", async () => {
      const f = await fixture("Illegal Hotel", 1);
      const r = await book(f);
      await expect(
        asUser(f.hotel.ownerId, f.hotel.orgId, () => reservations().noShow(r.id, f.hotel.ownerId)),
      ).rejects.toMatchObject({ code: "reservation.no_show_too_early" });
      await asUser(f.hotel.ownerId, f.hotel.orgId, () =>
        reservations().cancel(r.id, null, f.hotel.ownerId),
      );
      await expect(
        asUser(f.hotel.ownerId, f.hotel.orgId, () => reservations().confirm(r.id, f.hotel.ownerId)),
      ).rejects.toMatchObject({ code: "reservation.invalid_transition" });
      await expect(
        asUser(f.hotel.ownerId, f.hotel.orgId, () =>
          reservations().changeDates(r.id, "2026-10-10", "2026-10-12", f.hotel.ownerId),
        ),
      ).rejects.toMatchObject({ code: "reservation.not_modifiable" });
    });

    it("marks a confirmed guest arriving today as a no-show and frees the room", async () => {
      const f = await fixture("No-show Hotel", 1);
      const r = await book(f, { arrival: TODAY, departure: "2026-10-03", confirm: true });
      const ns = await asUser(f.hotel.ownerId, f.hotel.orgId, () =>
        reservations().noShow(r.id, f.hotel.ownerId),
      );
      expect(ns.status).toBe("no_show");
      await expect(book(f, { arrival: TODAY, departure: "2026-10-02" })).resolves.toBeDefined();
    });
  });

  describe("changing a booking", () => {
    it("moves to a free room of the same type, but never onto a taken one", async () => {
      const f = await fixture("Move Hotel", 3);
      const a = await book(f, { roomId: f.roomIds[0] });
      await book(f, { roomId: f.roomIds[1] });
      await expect(
        asUser(f.hotel.ownerId, f.hotel.orgId, () =>
          reservations().changeRoom(a.id, f.roomIds[1]!, f.hotel.ownerId),
        ),
      ).rejects.toMatchObject({ code: "reservation.room_unavailable" });
      const moved = await asUser(f.hotel.ownerId, f.hotel.orgId, () =>
        reservations().changeRoom(a.id, f.roomIds[2]!, f.hotel.ownerId),
      );
      expect(moved.roomId).toBe(f.roomIds[2]);
    });

    it("re-prices new dates and switches room only when the current one is taken", async () => {
      const f = await fixture("Dates Hotel", 2, 5000);
      const a = await book(f, {
        roomId: f.roomIds[0],
        arrival: "2026-10-05",
        departure: "2026-10-07",
      });
      await book(f, { roomId: f.roomIds[0], arrival: "2026-10-07", departure: "2026-10-09" });
      const same = await asUser(f.hotel.ownerId, f.hotel.orgId, () =>
        reservations().changeDates(a.id, "2026-10-04", "2026-10-07", f.hotel.ownerId),
      );
      expect(same).toMatchObject({ roomId: f.roomIds[0], nights: 3, total: 15000 });
      const moved = await asUser(f.hotel.ownerId, f.hotel.orgId, () =>
        reservations().changeDates(a.id, "2026-10-05", "2026-10-09", f.hotel.ownerId),
      );
      expect(moved).toMatchObject({ roomId: f.roomIds[1], nights: 4, total: 20000 });
    });
  });

  describe("NO DOUBLE BOOKING under concurrency (acceptance criterion)", () => {
    it("20 simultaneous bookings of the SAME room: exactly one wins", async () => {
      const f = await fixture("Race One Room", 1);
      const results = await Promise.allSettled(
        Array.from({ length: 20 }, () => book(f, { roomId: f.roomIds[0] })),
      );
      const won = results.filter((r) => r.status === "fulfilled");
      const lost = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
      expect(won).toHaveLength(1);
      expect(lost).toHaveLength(19);
      for (const l of lost)
        expect(l.reason).toMatchObject({ code: "reservation.room_unavailable" });
      expect(await overlappingAllocations()).toBe(0);
    }, 60_000);

    it("12 simultaneous auto-assigned bookings for 3 rooms: exactly 3 win, all on different rooms", async () => {
      const f = await fixture("Race Room Type", 3);
      const results = await Promise.allSettled(Array.from({ length: 12 }, () => book(f)));
      const won = results
        .filter(
          (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof book>>> =>
            r.status === "fulfilled",
        )
        .map((r) => r.value);
      const lost = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
      expect(won).toHaveLength(3);
      expect(new Set(won.map((w) => w.roomId)).size).toBe(3);
      for (const l of lost) expect(l.reason).toMatchObject({ code: "reservation.no_availability" });
      expect(await overlappingAllocations()).toBe(0);
      // The losing transactions rolled back completely: no orphaned reservations.
      const rows = await ownerQuery<{ n: string }>(
        `SELECT count(*)::text AS n FROM hotel_reservations WHERE organization_id = $1`,
        [f.hotel.orgId],
      );
      expect(Number(rows[0]!.n)).toBe(3);
    }, 60_000);

    it("staggered overlapping ranges racing for one room never produce an overlap", async () => {
      const f = await fixture("Race Staggered", 1);
      const ranges: Array<[string, string]> = [
        ["2026-10-05", "2026-10-08"],
        ["2026-10-06", "2026-10-09"],
        ["2026-10-07", "2026-10-10"],
        ["2026-10-08", "2026-10-11"],
        ["2026-10-04", "2026-10-06"],
        ["2026-10-10", "2026-10-12"],
      ];
      await Promise.allSettled(
        ranges.flatMap(([arrival, departure]) => [
          book(f, { roomId: f.roomIds[0], arrival, departure }),
          book(f, { roomId: f.roomIds[0], arrival, departure }),
        ]),
      );
      expect(await overlappingAllocations()).toBe(0);
    }, 60_000);
  });

  describe("availability, calendar and the room board", () => {
    it("counts free rooms per type and quotes each, net of existing bookings", async () => {
      const f = await fixture("Availability Hotel", 2, 5000);
      await book(f);
      const res = await asUser(f.hotel.ownerId, f.hotel.orgId, () =>
        availability().search({
          arrival: "2026-10-05",
          departure: "2026-10-08",
          adults: 2,
          children: 0,
        }),
      );
      expect(res.results).toEqual([
        expect.objectContaining({
          availableRooms: 1,
          bookable: true,
          quote: expect.objectContaining({ total: 15000 }),
        }),
      ]);
      const tooMany = await asUser(f.hotel.ownerId, f.hotel.orgId, () =>
        availability().search({
          arrival: "2026-10-05",
          departure: "2026-10-08",
          adults: 3,
          children: 0,
        }),
      );
      expect(tooMany.results[0]).toMatchObject({
        bookable: false,
        unavailableReason: "Sleeps at most 2.",
      });
    });

    it("draws reservations as bars on the calendar", async () => {
      const f = await fixture("Calendar Hotel", 1);
      const r = await book(f, { arrival: "2026-10-02", departure: "2026-10-04" });
      const cal = await asUser(f.hotel.ownerId, f.hotel.orgId, () =>
        availability().calendar(TODAY, 7),
      );
      expect(cal.days).toHaveLength(7);
      expect(cal.rooms[0]!.bars).toEqual([
        expect.objectContaining({
          code: r.code,
          start: "2026-10-02",
          end: "2026-10-04",
          guestName: "Karim Fathy",
        }),
      ]);
    });

    it("shows a confirmed arrival due today as Reserved on the room board", async () => {
      const f = await fixture("Board Hotel", 2);
      await book(f, {
        roomId: f.roomIds[0],
        arrival: TODAY,
        departure: "2026-10-03",
        confirm: true,
      });
      const board = await asUser(f.hotel.ownerId, f.hotel.orgId, () =>
        get<RoomsService>(app, RoomsService).list(),
      );
      expect(board.map((r) => [r.number, r.displayStatus, r.currentGuest])).toEqual([
        ["301", "reserved", "Karim Fathy"],
        ["302", "available", null],
      ]);
    });
  });

  describe("HTTP: authorization and input", () => {
    it("never accepts a client-supplied price", async () => {
      const f = await fixture("Price Hotel", 1);
      const token = await loginAs(http, f.hotel.ownerEmail);
      const res = await http.inject({
        method: "POST",
        url: "/api/hotel/reservations",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          guestId: f.guestId,
          roomTypeId: f.typeId,
          arrival: "2026-10-05",
          departure: "2026-10-06",
          adults: 1,
          source: "direct",
          total: 1,
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it("lets a receptionist book and confirm, but not cancel; housekeeping only reads", async () => {
      const f = await fixture("Authz Hotel", 2);
      const clerk = await seedStaff(app, f.hotel, "receptionist", "Rania Kamal");
      const maid = await seedStaff(app, f.hotel, "housekeeping", "Hassan Ali");
      const clerkToken = await loginAs(http, clerk.email);
      const maidToken = await loginAs(http, maid.email);
      const body = {
        guestId: f.guestId,
        roomTypeId: f.typeId,
        arrival: "2026-10-05",
        departure: "2026-10-06",
        adults: 1,
        source: "walk_in",
        confirm: true,
      };
      const created = await http.inject({
        method: "POST",
        url: "/api/hotel/reservations",
        headers: { authorization: `Bearer ${clerkToken}` },
        payload: body,
      });
      expect(created.statusCode).toBe(201);
      const id = (created.json() as { id: string }).id;

      const cancel = await http.inject({
        method: "POST",
        url: `/api/hotel/reservations/${id}/cancel`,
        headers: { authorization: `Bearer ${clerkToken}` },
        payload: {},
      });
      expect(cancel.statusCode).toBe(403);

      const maidCreate = await http.inject({
        method: "POST",
        url: "/api/hotel/reservations",
        headers: { authorization: `Bearer ${maidToken}` },
        payload: body,
      });
      expect(maidCreate.statusCode).toBe(403);
      const maidRead = await http.inject({
        method: "GET",
        url: `/api/hotel/reservations/${id}`,
        headers: { authorization: `Bearer ${maidToken}` },
      });
      expect(maidRead.statusCode).toBe(200);
    });

    it("never shows one hotel's reservation to another", async () => {
      const a = await fixture("Tenant A", 1);
      const b = await fixture("Tenant B", 1);
      const r = await book(a);
      await expect(
        asUser(b.hotel.ownerId, b.hotel.orgId, () => reservations().get(r.id)),
      ).rejects.toMatchObject({ code: "reservation.not_found" });
      await expect(
        asUser(b.hotel.ownerId, b.hotel.orgId, () =>
          reservations().cancel(r.id, null, b.hotel.ownerId),
        ),
      ).rejects.toMatchObject({ code: "reservation.not_found" });
    });
  });
});
