/**
 * Slice 6 — analytics: occupancy, ADR, RevPAR, revenue split, average stay, cancellation and
 * no-show rates, channel and payment-method mix — all derived from the ledgers for a window of
 * nights, checked against a hand-computed small hotel.
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
import { AnalyticsService } from "@hotel/hotel/analytics/application/analytics-service.js";
import {
  asUser,
  createHotelHttpTestApp,
  get,
  hasTestDb,
  loginAs,
  seedHotel,
  seedStaff,
} from "./helpers.js";

const clock = fixedClock("2026-10-01T08:00:00.000Z");
const TODAY = "2026-10-01";

describe.skipIf(!hasTestDb)("HotelOS analytics (Slice 6)", () => {
  let app: TestingModule;
  let http: NestFastifyApplication;

  beforeAll(async () => {
    const booted = await createHotelHttpTestApp({ clock });
    app = booted.moduleRef;
    http = booted.http;
  }, 120_000);

  afterAll(async () => {
    await http?.close();
  });

  it("computes the last 7 nights' performance from stays, charges, payments and lost bookings", async () => {
    const hotel = await seedHotel(app, "Analytics Hotel");
    const as = <T>(date: string, fn: () => Promise<T>) =>
      runAsOf(date, () => asUser(hotel.ownerId, hotel.orgId, fn));
    const reservations = get<ReservationsService>(app, ReservationsService);
    const desk = get<FrontDeskService>(app, FrontDeskService);
    const billing = get<BillingService>(app, BillingService);

    const { typeId, roomIds, guestId } = await as("2026-09-20", async () => {
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
      const rooms = get<RoomsService>(app, RoomsService);
      const r1 = await rooms.create(
        { number: "501", floor: 5, roomTypeId: type.id },
        hotel.ownerId,
      );
      const r2 = await rooms.create(
        { number: "502", floor: 5, roomTypeId: type.id },
        hotel.ownerId,
      );
      const guest = await get<GuestsService>(app, GuestsService).create(
        {
          fullName: "Heba Mostafa",
          phone: "+20 122 000 1111",
          email: null,
          nationality: "EG",
          idDocumentType: null,
          idDocumentNumber: null,
          preferences: null,
          vip: false,
        },
        hotel.ownerId,
      );
      return { typeId: type.id, roomIds: [r1.id, r2.id], guestId: guest.id };
    });
    const book = (
      on: string,
      arrival: string,
      departure: string,
      source: "phone" | "website" | "booking_com",
      roomId: string | null = null,
    ) =>
      as(on, () =>
        reservations.create(
          {
            guestId,
            roomTypeId: typeId,
            roomId,
            arrival,
            departure,
            adults: 2,
            children: 0,
            source,
            confirm: true,
          },
          hotel.ownerId,
        ),
      );

    // A: 2 nights (Sep 28–30), breakfast, pays everything by card at check-out.
    const a = await book("2026-09-25", "2026-09-28", "2026-09-30", "phone", roomIds[0]);
    await as("2026-09-28", () => desk.checkIn(a.id, {}, hotel.ownerId));
    await as("2026-09-28", () =>
      billing.postCharge(
        a.id,
        { kind: "breakfast", description: "Breakfast", quantity: 2, unitPrice: 350 },
        hotel.ownerId,
      ),
    );
    await as("2026-09-30", () =>
      desk.checkOut(
        a.id,
        { payment: { method: "card", amount: 12198, idempotencyKey: `an-a-${Date.now()}` } },
        hotel.ownerId,
      ),
    );
    // B: 2 nights (Sep 30 – Oct 2), in house tonight, left a cash deposit.
    const b = await book("2026-09-26", "2026-09-30", "2026-10-02", "website", roomIds[1]);
    await as("2026-09-30", () => desk.checkIn(b.id, {}, hotel.ownerId));
    await as("2026-09-30", () =>
      billing.collectPayment(
        b.id,
        { method: "cash", amount: 1000, idempotencyKey: `an-b-${Date.now()}` },
        hotel.ownerId,
      ),
    );
    // Lost business: one cancellation, one no-show.
    const c = await book("2026-09-20", "2026-09-29", "2026-09-30", "booking_com");
    await as("2026-09-22", () => reservations.cancel(c.id, "Change of plans", hotel.ownerId));
    const n = await book("2026-09-20", "2026-09-27", "2026-09-28", "booking_com");
    await as("2026-09-27", () => reservations.noShow(n.id, hotel.ownerId));

    const report = await as(TODAY, () => get<AnalyticsService>(app, AnalyticsService).overview(7));
    expect(report.range).toEqual({ days: 7, from: "2026-09-25", to: "2026-10-02" });
    // Sold: Sep 28, 29 (A) + Sep 30, Oct 1 (B) = 4 of 7 × 2 = 14 room-nights.
    expect(report.performance).toEqual({
      occupancyPct: 28.6,
      adr: 5000,
      revpar: 1428.57,
      roomNightsSold: 4,
      roomNightsAvailable: 14,
      roomRevenue: 20000,
      extrasRevenue: 700,
      totalRevenue: 20700,
    });
    expect(report).toMatchObject({
      bookings: 4,
      avgStayNights: 2,
      cancellationRatePct: 25,
      noShowRatePct: 25,
    });
    expect(report.series).toHaveLength(7);
    expect(report.series.find((d) => d.date === "2026-09-28")).toEqual({
      date: "2026-09-28",
      occupancyPct: 50,
      roomRevenue: 5000,
      totalRevenue: 5700,
    });
    expect(report.sources).toEqual([
      { source: "phone", bookings: 1, revenue: 10000, pct: 50 },
      { source: "website", bookings: 1, revenue: 10000, pct: 50 },
    ]);
    expect(report.paymentMethods).toEqual([
      { method: "card", amount: 12198, pct: 92.4 },
      { method: "cash", amount: 1000, pct: 7.6 },
    ]);
    // The week before had nothing on the books.
    expect(report.previous).toMatchObject({ occupancyPct: 0, totalRevenue: 0 });
  });

  it("HTTP: analytics is for managers and finance, not the front desk", async () => {
    const hotel = await seedHotel(app, "Analytics Perms");
    const accountant = await seedStaff(app, hotel, "accountant", "Dina Samir");
    const receptionist = await seedStaff(app, hotel, "receptionist", "Rania Kamal");
    const at = await loginAs(http, accountant.email);
    const rt = await loginAs(http, receptionist.email);
    const call = (token: string, days = "30") =>
      http.inject({
        method: "GET",
        url: `/api/hotel/analytics?days=${days}`,
        headers: { authorization: `Bearer ${token}` },
      });
    expect((await call(rt)).statusCode).toBe(403);
    const ok = await call(at, "90");
    expect(ok.statusCode).toBe(200);
    expect(ok.json().series).toHaveLength(90);
    expect((await call(at, "14")).statusCode).toBe(400);
  });
});
