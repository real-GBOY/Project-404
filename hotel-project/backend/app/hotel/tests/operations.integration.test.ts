/**
 * Slice 4 — operations: maintenance tickets whose room blocks live in the SAME allocation ledger
 * as reservations (so a block and a booking can never overlap, in either direction), rooms that
 * only return to service when a repair is verified, and a dashboard computed from the ledgers.
 */
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { TestingModule } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@core/kernel/clock.js";
import { runAsOf } from "@hotel/hotel/shared/business-date.js";
import { RoomTypesService } from "@hotel/hotel/rooms/application/room-types-service.js";
import { RoomsService } from "@hotel/hotel/rooms/application/rooms-service.js";
import { GuestsService } from "@hotel/hotel/guests/application/guests-service.js";
import { ReservationsService } from "@hotel/hotel/reservations/application/reservations-service.js";
import { FrontDeskService } from "@hotel/hotel/front-desk/application/front-desk-service.js";
import { BillingService } from "@hotel/hotel/billing/application/billing-service.js";
import { MaintenanceService } from "@hotel/hotel/maintenance/application/maintenance-service.js";
import { DashboardService } from "@hotel/hotel/dashboard/application/dashboard-service.js";
import { HousekeepingService } from "@hotel/hotel/housekeeping/application/housekeeping-service.js";
import {
  asUser,
  createHotelHttpTestApp,
  get,
  hasTestDb,
  seedHotel,
  seedStaff,
  type SeededHotel,
} from "./helpers.js";

const clock = fixedClock("2026-10-01T08:00:00.000Z");
const TODAY = "2026-10-01";

describe.skipIf(!hasTestDb)("HotelOS operations (Slice 4)", () => {
  let app: TestingModule;
  let http: NestFastifyApplication;
  const svc = {
    rooms: () => get<RoomsService>(app, RoomsService),
    reservations: () => get<ReservationsService>(app, ReservationsService),
    desk: () => get<FrontDeskService>(app, FrontDeskService),
    billing: () => get<BillingService>(app, BillingService),
    maintenance: () => get<MaintenanceService>(app, MaintenanceService),
    dashboard: () => get<DashboardService>(app, DashboardService),
  };

  interface Hotel {
    hotel: SeededHotel;
    typeId: string;
    roomIds: string[];
    guestId: string;
    as: <T>(date: string, fn: () => Promise<T>) => Promise<T>;
  }

  async function setupHotel(name: string, rooms = 2): Promise<Hotel> {
    const hotel = await seedHotel(app, name);
    const as = <T>(date: string, fn: () => Promise<T>) =>
      runAsOf(date, () => asUser(hotel.ownerId, hotel.orgId, fn));
    const ids = await as(TODAY, async () => {
      const type = await get<RoomTypesService>(app, RoomTypesService).create(
        {
          code: "DLX",
          name: "Grand Deluxe Room",
          capacity: 2,
          beds: "1 King bed",
          baseRate: 5000,
          amenities: [],
          sortOrder: 0,
        },
        hotel.ownerId,
      );
      const roomIds: string[] = [];
      for (let i = 1; i <= rooms; i++) {
        roomIds.push(
          (
            await svc
              .rooms()
              .create({ number: `30${i}`, floor: 3, roomTypeId: type.id }, hotel.ownerId)
          ).id,
        );
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
      return { typeId: type.id, roomIds, guestId: guest.id };
    });
    return { hotel, ...ids, as };
  }

  const book = (h: Hotel, roomId: string | null, arrival: string, departure: string) =>
    h.as(TODAY, () =>
      svc.reservations().create(
        {
          guestId: h.guestId,
          roomTypeId: h.typeId,
          roomId,
          arrival,
          departure,
          adults: 2,
          children: 0,
          source: "phone",
          confirm: true,
        },
        h.hotel.ownerId,
      ),
    );

  const block = (h: Hotel, roomId: string, expectedBack: string) =>
    h.as(TODAY, () =>
      svc.maintenance().report(
        {
          roomId,
          title: "Bathroom leak",
          description: null,
          priority: "high",
          roomImpact: "out_of_service",
          expectedBack,
        },
        h.hotel.ownerId,
      ),
    );

  beforeAll(async () => {
    const booted = await createHotelHttpTestApp({ clock });
    app = booted.moduleRef;
    http = booted.http;
  }, 120_000);

  afterAll(async () => {
    await http?.close();
  });

  describe("room blocks share the no-double-booking ledger", () => {
    it("refuses to block a room over a booked stay, naming the booking", async () => {
      const h = await setupHotel("Block vs Booking");
      const r = await book(h, h.roomIds[0]!, "2026-10-03", "2026-10-05");
      await expect(block(h, h.roomIds[0]!, "2026-10-04")).rejects.toMatchObject({
        code: "maintenance.room_booked",
        details: { reservations: [r.code] },
      });
      // …but the block fits if it ends before that stay begins.
      await expect(block(h, h.roomIds[0]!, "2026-10-03")).resolves.toMatchObject({
        roomImpact: "out_of_service",
      });
    });

    it("refuses to sell a blocked room and auto-assigns around the block", async () => {
      const h = await setupHotel("Booking vs Block");
      await block(h, h.roomIds[0]!, "2026-10-05");
      await expect(book(h, h.roomIds[0]!, "2026-10-02", "2026-10-03")).rejects.toMatchObject({
        code: "reservation.room_unavailable",
      });
      const auto = await book(h, null, "2026-10-02", "2026-10-03");
      expect(auto.roomId).toBe(h.roomIds[1]);
      await expect(book(h, null, "2026-10-02", "2026-10-03")).rejects.toMatchObject({
        code: "reservation.no_availability",
      });
    });

    it("keeps a room out of service until the repair is VERIFIED — not when it's merely resolved", async () => {
      const h = await setupHotel("Verify Hotel", 1);
      const t = await block(h, h.roomIds[0]!, "2026-10-06");
      let room = await h.as(TODAY, () => svc.rooms().get(h.roomIds[0]!));
      expect(room).toMatchObject({
        serviceStatus: "out_of_service",
        displayStatus: "out_of_service",
      });

      const m = svc.maintenance();
      await h.as(TODAY, () => m.start(t.id, h.hotel.ownerId));
      await h.as(TODAY, () => m.resolve(t.id, "Resealed", h.hotel.ownerId));
      room = await h.as(TODAY, () => svc.rooms().get(h.roomIds[0]!));
      expect(room.displayStatus).toBe("out_of_service");

      await h.as("2026-10-02", () => m.verify(t.id, h.hotel.ownerId));
      room = await h.as("2026-10-02", () => svc.rooms().get(h.roomIds[0]!));
      expect(room).toMatchObject({ serviceStatus: "in_service", displayStatus: "available" });
      // The unused block nights are back on sale.
      await expect(book(h, h.roomIds[0]!, "2026-10-03", "2026-10-06")).resolves.toBeDefined();

      const detail = await h.as(TODAY, () => m.get(t.id));
      expect(detail.timeline.map((e) => e.kind)).toEqual([
        "reported",
        "started",
        "resolved",
        "verified",
      ]);
    });

    it("extends a block only into free nights", async () => {
      const h = await setupHotel("Extend Block", 1);
      const t = await block(h, h.roomIds[0]!, "2026-10-04");
      await book(h, h.roomIds[0]!, "2026-10-06", "2026-10-08");
      await h.as(TODAY, () => svc.maintenance().extendBlock(t.id, "2026-10-06", h.hotel.ownerId));
      await expect(
        h.as(TODAY, () => svc.maintenance().extendBlock(t.id, "2026-10-07", h.hotel.ownerId)),
      ).rejects.toMatchObject({ code: "maintenance.room_booked" });
    });
  });

  describe("permissions", () => {
    it("housekeeping can report but not take a room out of sale; technicians can't verify", async () => {
      const h = await setupHotel("Maint Perms", 1);
      const maid = await seedStaff(app, h.hotel, "housekeeping", "Hassan Ali");
      const tech = await seedStaff(app, h.hotel, "maintenance", "Omar Tarek");
      const other = await seedStaff(app, h.hotel, "maintenance", "Second Tech");
      const asStaff = <T>(userId: string, fn: () => Promise<T>) =>
        runAsOf(TODAY, () => asUser(userId, h.hotel.orgId, fn));

      await expect(
        asStaff(maid.userId, () =>
          svc.maintenance().report(
            {
              roomId: h.roomIds[0]!,
              title: "Leak",
              description: null,
              priority: "high",
              roomImpact: "maintenance",
              expectedBack: "2026-10-03",
            },
            maid.userId,
          ),
        ),
      ).rejects.toMatchObject({ code: "maintenance.supervisor_only" });
      const t = await asStaff(maid.userId, () =>
        svc.maintenance().report(
          {
            roomId: h.roomIds[0]!,
            title: "Dripping tap",
            description: null,
            priority: "low",
            roomImpact: "none",
            expectedBack: null,
          },
          maid.userId,
        ),
      );
      await h.as(TODAY, () => svc.maintenance().assign(t.id, tech.userId, h.hotel.ownerId));
      await expect(
        asStaff(other.userId, () => svc.maintenance().start(t.id, other.userId)),
      ).rejects.toMatchObject({
        code: "maintenance.not_your_ticket",
      });
      await asStaff(tech.userId, () => svc.maintenance().start(t.id, tech.userId));
      await asStaff(tech.userId, () => svc.maintenance().setCost(t.id, 85, tech.userId));
      await asStaff(tech.userId, () => svc.maintenance().resolve(t.id, "New washer", tech.userId));
      await expect(
        asStaff(tech.userId, () => svc.maintenance().verify(t.id, tech.userId)),
      ).rejects.toMatchObject({
        code: "maintenance.supervisor_only",
      });
    });
  });

  it("shows the housekeeping board: open work plus today's finished rooms, not old history", async () => {
    const h = await setupHotel("Board Hotel", 3);
    const hk = get<HousekeepingService>(app, HousekeepingService);
    const task = (roomId: string) => ({
      roomId,
      kind: "deep_clean" as const,
      priority: "normal" as const,
      notes: null,
    });
    const old = await h.as("2026-09-29", () => hk.create(task(h.roomIds[0]!), h.hotel.ownerId));
    await h.as("2026-09-29", () => hk.start(old.id, h.hotel.ownerId));
    await h.as("2026-09-29", () => hk.complete(old.id, null, h.hotel.ownerId));
    const stale = await h.as("2026-09-30", () => hk.create(task(h.roomIds[1]!), h.hotel.ownerId));
    const done = await h.as(TODAY, () => hk.create(task(h.roomIds[2]!), h.hotel.ownerId));
    await h.as(TODAY, () => hk.start(done.id, h.hotel.ownerId));
    await h.as(TODAY, () => hk.complete(done.id, null, h.hotel.ownerId));

    const board = await h.as(TODAY, () => hk.list({ board: true }));
    expect(board.map((t) => t.id).sort()).toEqual([stale.id, done.id].sort());
  });

  it("computes the dashboard from the ledgers", async () => {
    const h = await setupHotel("Dashboard Hotel", 4);
    // Room 1: in house since yesterday (2 nights). Room 2: arriving today. Room 3: out of service.
    const stay = await h.as("2026-09-30", () =>
      svc.reservations().create(
        {
          guestId: h.guestId,
          roomTypeId: h.typeId,
          roomId: h.roomIds[0],
          arrival: "2026-09-30",
          departure: "2026-10-02",
          adults: 2,
          children: 0,
          source: "phone",
          confirm: true,
        },
        h.hotel.ownerId,
      ),
    );
    await h.as("2026-09-30", () => svc.desk().checkIn(stay.id, {}, h.hotel.ownerId));
    await book(h, h.roomIds[1]!, TODAY, "2026-10-03");
    await block(h, h.roomIds[2]!, "2026-10-05");
    await h.as(TODAY, () =>
      svc
        .billing()
        .collectPayment(
          stay.id,
          { method: "card", amount: 2000, idempotencyKey: `dash-${Date.now()}` },
          h.hotel.ownerId,
        ),
    );

    const d = await h.as(TODAY, () => svc.dashboard().overview());
    // Tonight: 2 rooms on the books (in-house + arrival) out of 3 sellable (4 − 1 blocked).
    expect(d.kpis).toMatchObject({
      occupancyPct: 66.7,
      revenueToday: 5000,
      arrivals: { total: 1, pending: 1 },
      departures: { total: 0, pending: 0 },
      availableRooms: 1,
      totalRooms: 4,
      outstanding: 9400, // 2 nights × 5,000 + 14% VAT − 2,000 paid
    });
    expect(d.trend).toHaveLength(7);
    expect(d.trend.at(-2)).toMatchObject({ date: "2026-09-30", occupancyPct: 25, revenue: 5000 });
    expect(d.roomStatus).toMatchObject({
      occupied: 1,
      reserved: 1,
      out_of_service: 1,
      available: 1,
    });
    expect(d.alerts.map((a) => a.type)).toContain("maintenance");
    expect(d.recentReservations.length).toBeGreaterThanOrEqual(2);
  });
});
