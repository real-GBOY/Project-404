/**
 * Slice 8 — the public booking API, end to end over HTTP with no sign-in: hotel info,
 * availability with VAT-inclusive prices, bookings through the real reservation engine,
 * idempotency, rate limiting, and the front desk hearing about new website bookings.
 */
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { TestingModule } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@core/kernel/clock.js";
import { NotificationService } from "@core/notifications/application/notification-service.js";
import { runAsOf } from "@hotel/hotel/shared/business-date.js";
import { RoomTypesService } from "@hotel/hotel/rooms/application/room-types-service.js";
import { RoomsService } from "@hotel/hotel/rooms/application/rooms-service.js";
import { ReservationsService } from "@hotel/hotel/reservations/application/reservations-service.js";
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
let keySeq = 0;
const newKey = () => `test-booking-key-${Date.now()}-${keySeq++}`;

describe.skipIf(!hasTestDb)("HotelOS public booking API (Slice 8)", () => {
  let app: TestingModule;
  let http: NestFastifyApplication;

  interface Hotel {
    hotel: SeededHotel;
    typeId: string;
    suiteId: string;
  }

  async function setupHotel(name: string): Promise<Hotel> {
    const hotel = await seedHotel(app, name);
    const ids = await runAsOf(TODAY, () =>
      asUser(hotel.ownerId, hotel.orgId, async () => {
        const types = get<RoomTypesService>(app, RoomTypesService);
        const dlx = await types.create(
          {
            code: "DLX",
            name: "Grand Deluxe Room",
            capacity: 2,
            beds: "1 King bed",
            baseRate: 5000,
            amenities: ["Nile view"],
            sortOrder: 0,
          },
          hotel.ownerId,
        );
        const ste = await types.create(
          {
            code: "STE",
            name: "Serenity Suite",
            capacity: 4,
            beds: "1 King bed + sofa bed",
            baseRate: 9800,
            amenities: [],
            sortOrder: 1,
          },
          hotel.ownerId,
        );
        const rooms = get<RoomsService>(app, RoomsService);
        await rooms.create({ number: "701", floor: 7, roomTypeId: dlx.id }, hotel.ownerId);
        await rooms.create({ number: "702", floor: 7, roomTypeId: dlx.id }, hotel.ownerId);
        await rooms.create({ number: "801", floor: 8, roomTypeId: ste.id }, hotel.ownerId);
        return { typeId: dlx.id, suiteId: ste.id };
      }),
    );
    return { hotel, ...ids };
  }

  const booking = (h: Hotel, over: Record<string, unknown> = {}) => ({
    roomTypeId: h.typeId,
    arrival: "2026-10-10",
    departure: "2026-10-12",
    adults: 2,
    guest: { fullName: "Laila Hassan", email: "laila@example.com", phone: "+20 100 000 0000" },
    ...over,
  });

  const post = (h: Hotel, body: unknown, key?: string, ip = "198.51.100.7") =>
    http.inject({
      method: "POST",
      url: `/api/public/hotels/${h.hotel.slug}/bookings`,
      headers: { ...(key && { "idempotency-key": key }), "x-forwarded-for": ip },
      payload: body as Record<string, unknown>,
    });

  beforeAll(async () => {
    const booted = await createHotelHttpTestApp({ clock });
    app = booted.moduleRef;
    http = booted.http;
  }, 120_000);

  afterAll(async () => {
    await http?.close();
  });

  it("describes the hotel and quotes VAT-inclusive prices for what's actually free", async () => {
    const h = await setupHotel("Public Info Hotel");
    const info = await http.inject({ method: "GET", url: `/api/public/hotels/${h.hotel.slug}` });
    expect(info.statusCode).toBe(200);
    expect(info.json()).toMatchObject({
      name: "Public Info Hotel",
      currency: "EGP",
      taxRate: 0.14,
      roomTypes: [
        expect.objectContaining({ name: "Grand Deluxe Room", fromRate: 5000 }),
        expect.objectContaining({ name: "Serenity Suite" }),
      ],
    });
    // Nothing internal leaks: no room numbers, no inventory counts beyond "a few left".
    expect(JSON.stringify(info.json())).not.toContain("701");

    const search = await http.inject({
      method: "GET",
      url: `/api/public/hotels/${h.hotel.slug}/availability?arrival=2026-10-10&departure=2026-10-12&adults=3`,
    });
    expect(search.statusCode).toBe(200);
    // Three guests only fit the suite.
    expect(search.json().results).toEqual([
      expect.objectContaining({
        roomType: expect.objectContaining({ name: "Serenity Suite" }),
        fewLeft: 1,
        total: 19600,
        tax: 2744,
        grandTotal: 22344,
      }),
    ]);

    const unknown = await http.inject({ method: "GET", url: "/api/public/hotels/no-such-hotel" });
    expect(unknown.statusCode).toBe(404);
  });

  it("books through the reservation engine — once per Idempotency-Key", async () => {
    const h = await setupHotel("Public Booking Hotel");
    const desk = await seedStaff(app, h.hotel, "receptionist", "Rania Kamal");

    expect((await post(h, booking(h))).statusCode).toBe(400); // no Idempotency-Key

    const key = newKey();
    const first = await post(h, booking(h), key);
    expect(first.statusCode).toBe(201);
    expect(first.json()).toMatchObject({
      status: "confirmed",
      guestName: "Laila Hassan",
      roomTypeName: "Grand Deluxe Room",
      nights: 2,
      total: 10000,
      tax: 1400,
      grandTotal: 11400,
    });
    const code = first.json().code as string;

    // A retry (double-click, flaky network) returns the same booking…
    const retry = await post(h, booking(h), key);
    expect(retry.statusCode).toBe(201);
    expect(retry.json().code).toBe(code);
    // …but the same key for a different booking is refused.
    const reused = await post(h, booking(h, { departure: "2026-10-13" }), key);
    expect(reused.statusCode).toBe(409);
    expect(reused.json().error.code).toBe("booking.idempotency_mismatch");

    // Staff see it as a website booking made by the guest (the system), and were told about it.
    const staffView = await runAsOf(TODAY, () =>
      asUser(h.hotel.ownerId, h.hotel.orgId, async () => {
        const list = await get<ReservationsService>(app, ReservationsService).list({
          page: 1,
          pageSize: 50,
        });
        return list.items.find((r) => r.code === code)!;
      }),
    );
    expect(staffView).toMatchObject({ source: "website", status: "confirmed" });
    const inbox = await asUser(desk.userId, h.hotel.orgId, () =>
      get<NotificationService>(app, NotificationService).listForUser(desk.userId, {}),
    );
    expect(inbox.map((n) => n.title)).toContain(`New website booking #${code}`);

    // The same guest booking again is the same guest profile, not a duplicate.
    const second = await post(
      h,
      booking(h, {
        arrival: "2026-10-20",
        departure: "2026-10-21",
        guest: { fullName: "Laila Hassan", email: "LAILA@example.com" },
      }),
      newKey(),
    );
    expect(second.statusCode).toBe(201);
    const guests = await runAsOf(TODAY, () =>
      asUser(h.hotel.ownerId, h.hotel.orgId, async () =>
        (
          await get<ReservationsService>(app, ReservationsService).list({ page: 1, pageSize: 50 })
        ).items.map((r) => r.guestId),
      ),
    );
    expect(new Set(guests).size).toBe(1);
  });

  it("never double-books: when the type is sold out the website hears so", async () => {
    const h = await setupHotel("Public Sold Out");
    const suite = (email: string) =>
      booking(h, { roomTypeId: h.suiteId, guest: { fullName: "Guest One", email } });
    const results = await Promise.all([
      post(h, suite("a@example.com"), newKey(), "203.0.113.1"),
      post(h, suite("b@example.com"), newKey(), "203.0.113.2"),
      post(h, suite("c@example.com"), newKey(), "203.0.113.3"),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([201, 409, 409]);
    const refused = results.find((r) => r.statusCode === 409)!;
    expect(refused.json().error.code).toBe("reservation.no_availability");
  });

  it("rate-limits bookings per client address, with Retry-After", async () => {
    const h = await setupHotel("Public Rate Limit");
    const ip = "192.0.2.44";
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await post(
        h,
        booking(h, {
          arrival: `2026-11-0${i + 1}`,
          departure: `2026-11-0${i + 2}`,
          guest: { fullName: "Busy Bee", email: `bee${i}@example.com` },
        }),
        newKey(),
        ip,
      );
      codes.push(res.statusCode);
      if (res.statusCode === 429) {
        expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
        expect(res.json().error.code).toBe("rate_limited");
      }
    }
    expect(codes).toEqual([201, 201, 201, 201, 201, 429]);
    // Another visitor is unaffected.
    const other = await post(
      h,
      booking(h, { arrival: "2026-11-20", departure: "2026-11-21" }),
      newKey(),
      "192.0.2.45",
    );
    expect(other.statusCode).toBe(201);
  });
});
