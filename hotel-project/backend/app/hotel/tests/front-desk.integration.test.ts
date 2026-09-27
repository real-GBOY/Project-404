/**
 * Slice 3 — the front desk. Stays are walked across real calendar days with `runAsOf`, through
 * the real workflows: book → check in → extras & payments → check out (invoice, dirty room,
 * housekeeping task) → clean → inspect → the room is sellable again.
 */
import pg from "pg";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { TestingModule } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@core/kernel/clock.js";
import { TEST_DATABASE_URL } from "@core/tests/helpers.js";
import { EventRegistry } from "@core/events/registry.js";
import type { DomainEvent } from "@core/contracts/index.js";
import { runAsOf } from "@hotel/hotel/shared/business-date.js";
import { RoomTypesService } from "@hotel/hotel/rooms/application/room-types-service.js";
import { RoomsService } from "@hotel/hotel/rooms/application/rooms-service.js";
import { GuestsService } from "@hotel/hotel/guests/application/guests-service.js";
import { ReservationsService } from "@hotel/hotel/reservations/application/reservations-service.js";
import { BillingService } from "@hotel/hotel/billing/application/billing-service.js";
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
} from "@hotel/hotel/billing/domain/payment-provider.js";
import { HousekeepingService } from "@hotel/hotel/housekeeping/application/housekeeping-service.js";
import { FrontDeskService } from "@hotel/hotel/front-desk/application/front-desk-service.js";
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

const clock = fixedClock("2026-10-01T08:00:00.000Z");
const D1 = "2026-10-05"; // a Monday — no weekend pricing in these stays
const D2 = "2026-10-06";
const D3 = "2026-10-07";
const D4 = "2026-10-08";

async function ownerQuery<T extends pg.QueryResultRow>(text: string, params: unknown[] = []) {
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    return (await client.query<T>(text, params)).rows;
  } finally {
    await client.end();
  }
}

describe.skipIf(!hasTestDb)("HotelOS front desk (Slice 3)", () => {
  let app: TestingModule;
  let http: NestFastifyApplication;
  const events: DomainEvent[] = [];
  let key = 0;
  const idem = () => `test-key-${++key}-${Date.now()}`;

  const svc = {
    reservations: () => get<ReservationsService>(app, ReservationsService),
    billing: () => get<BillingService>(app, BillingService),
    desk: () => get<FrontDeskService>(app, FrontDeskService),
    housekeeping: () => get<HousekeepingService>(app, HousekeepingService),
    rooms: () => get<RoomsService>(app, RoomsService),
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
    const ids = await as("2026-10-01", async () => {
      const type = await get<RoomTypesService>(app, RoomTypesService).create(
        {
          code: "DBL",
          name: "Perfect Double Room",
          capacity: 2,
          beds: "1 Queen bed",
          baseRate: 4000,
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
              .create({ number: `20${i}`, floor: 2, roomTypeId: type.id }, hotel.ownerId)
          ).id,
        );
      }
      const guest = await get<GuestsService>(app, GuestsService).create(
        {
          fullName: "Sara El-Sayed",
          phone: "+20 122 987 1123",
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

  function book(h: Hotel, over: { arrival?: string; departure?: string; roomId?: string } = {}) {
    return h.as("2026-10-01", () =>
      svc.reservations().create(
        {
          guestId: h.guestId,
          roomTypeId: h.typeId,
          roomId: over.roomId ?? h.roomIds[0],
          arrival: over.arrival ?? D1,
          departure: over.departure ?? D4,
          adults: 2,
          children: 0,
          source: "direct",
          confirm: true,
        },
        h.hotel.ownerId,
      ),
    );
  }

  beforeAll(async () => {
    const booted = await createHotelHttpTestApp({ clock });
    app = booted.moduleRef;
    http = booted.http;
    const registry = get<EventRegistry>(app, EventRegistry);
    for (const name of [
      "reservation.checked_in",
      "reservation.checked_out",
      "payment.completed",
      "payment.failed",
      "invoice.issued",
      "housekeeping.task_created",
      "housekeeping.task_completed",
    ]) {
      registry.onInProcess(name, async (e) => {
        events.push(e);
      });
    }
  }, 120_000);

  afterAll(async () => {
    await http?.close();
  });

  it("walks a whole stay: check-in → extras → payments → check-out → clean → sellable again", async () => {
    const h = await setupHotel("Full Cycle Hotel");
    const r = await book(h); // 3 nights × 4,000 = 12,000 + 14% VAT = 13,680

    const inHouse = await h.as(D1, () => svc.desk().checkIn(r.id, {}, h.hotel.ownerId));
    expect(inHouse.status).toBe("checked_in");
    let folio = await h.as(D1, () => svc.billing().folio(r.id));
    expect(folio.charges.filter((c) => c.kind === "room")).toHaveLength(3);
    expect(folio.totals).toMatchObject({
      charges: 12000,
      tax: 1680,
      total: 13680,
      balance: 13680,
      paymentStatus: "pending",
      posted: true,
    });

    const board = await h.as(D1, () => svc.rooms().list());
    expect(board.find((x) => x.id === h.roomIds[0])).toMatchObject({
      displayStatus: "occupied",
      currentGuest: "Sara El-Sayed",
    });

    await h.as(D2, () =>
      svc
        .billing()
        .postCharge(
          r.id,
          { kind: "breakfast", description: "Breakfast × 2", quantity: 2, unitPrice: 250 },
          h.hotel.ownerId,
        ),
    );
    await h.as(D2, () =>
      svc
        .billing()
        .collectPayment(
          r.id,
          { method: "card", amount: 5000, idempotencyKey: idem() },
          h.hotel.ownerId,
        ),
    );
    folio = await h.as(D2, () => svc.billing().folio(r.id));
    expect(folio.totals).toMatchObject({
      total: 14250,
      paid: 5000,
      balance: 9250,
      paymentStatus: "partial",
    });

    await expect(
      h.as(D4, () => svc.desk().checkOut(r.id, {}, h.hotel.ownerId)),
    ).rejects.toMatchObject({
      code: "checkout.balance_due",
    });

    const out = await h.as(D4, () =>
      svc
        .desk()
        .checkOut(
          r.id,
          { payment: { method: "cash", amount: 9250, idempotencyKey: idem() } },
          h.hotel.ownerId,
        ),
    );
    expect(out.reservation.status).toBe("checked_out");
    const invoice = await h.as(D4, () => svc.billing().invoice(out.invoiceId));
    expect(invoice).toMatchObject({
      number: "INV-1001",
      subtotal: 12500,
      tax: 1750,
      total: 14250,
      billToName: "Sara El-Sayed",
    });
    expect(invoice.items).toHaveLength(4);
    folio = await h.as(D4, () => svc.billing().folio(r.id));
    expect(folio.totals).toMatchObject({ balance: 0, paymentStatus: "paid" });
    expect(folio.payments.every((p) => p.invoiceId === out.invoiceId)).toBe(true);

    // The room is dirty with an open task; housekeeping turns it around.
    let room = await h.as(D4, () => svc.rooms().get(h.roomIds[0]!));
    expect(room).toMatchObject({ housekeepingStatus: "dirty", displayStatus: "dirty" });
    const hk = svc.housekeeping();
    await h.as(D4, () => hk.start(out.housekeepingTaskId, h.hotel.ownerId));
    room = await h.as(D4, () => svc.rooms().get(h.roomIds[0]!));
    expect(room.displayStatus).toBe("cleaning");
    await h.as(D4, () => hk.complete(out.housekeepingTaskId, null, h.hotel.ownerId));
    room = await h.as(D4, () => svc.rooms().get(h.roomIds[0]!));
    expect(room).toMatchObject({ housekeepingStatus: "clean", displayStatus: "available" });
    await h.as(D4, () => hk.inspect(out.housekeepingTaskId, h.hotel.ownerId));
    room = await h.as(D4, () => svc.rooms().get(h.roomIds[0]!));
    expect(room.housekeepingStatus).toBe("inspected");

    const detail = await h.as(D4, () => svc.reservations().get(r.id));
    expect(detail.history.map((x) => x.toStatus)).toEqual([
      "pending",
      "confirmed",
      "checked_in",
      "checked_out",
    ]);
    const mine = events.filter(
      (e) => e.payload.reservationId === r.id || e.payload.taskId === out.housekeepingTaskId,
    );
    expect(mine.map((e) => e.name)).toEqual(
      expect.arrayContaining([
        "reservation.checked_in",
        "payment.completed",
        "invoice.issued",
        "reservation.checked_out",
        "housekeeping.task_created",
        "housekeeping.task_completed",
      ]),
    );
  });

  it("guards check-in: not before arrival, never into a dirty or occupied room, only confirmed stays", async () => {
    const h = await setupHotel("Check-in Guards");
    const r = await book(h);
    await expect(
      h.as("2026-10-04", () => svc.desk().checkIn(r.id, {}, h.hotel.ownerId)),
    ).rejects.toMatchObject({
      code: "checkin.too_early",
    });
    await h.as("2026-10-01", () => svc.reservations().cancel(r.id, null, h.hotel.ownerId));

    // A first guest stays one night in 201 and leaves it dirty.
    const first = await book(h, { arrival: D1, departure: D2 });
    await h.as(D1, () => svc.desk().checkIn(first.id, {}, h.hotel.ownerId));
    await h.as(D2, () =>
      svc
        .desk()
        .checkOut(
          first.id,
          { payment: { method: "cash", amount: 4560, idempotencyKey: idem() } },
          h.hotel.ownerId,
        ),
    );
    // 201 is now dirty: the next arrival cannot go in until housekeeping turns it.
    const next = await book(h, { arrival: D2, departure: D3 });
    await expect(
      h.as(D2, () => svc.desk().checkIn(next.id, {}, h.hotel.ownerId)),
    ).rejects.toMatchObject({
      code: "checkin.room_not_ready",
    });
    // …but can be moved to the clean room 202 at check-in.
    const moved = await h.as(D2, () =>
      svc.desk().checkIn(next.id, { roomId: h.roomIds[1] }, h.hotel.ownerId),
    );
    expect(moved).toMatchObject({ status: "checked_in", roomId: h.roomIds[1] });

    const pending = await h.as("2026-10-01", () =>
      svc.reservations().create(
        {
          guestId: h.guestId,
          roomTypeId: h.typeId,
          arrival: "2026-10-20",
          departure: "2026-10-21",
          adults: 1,
          children: 0,
          source: "phone",
        },
        h.hotel.ownerId,
      ),
    );
    await expect(
      h.as("2026-10-20", () => svc.desk().checkIn(pending.id, {}, h.hotel.ownerId)),
    ).rejects.toMatchObject({
      code: "reservation.invalid_transition",
    });
  });

  it("releases unused nights on an early check-out and refuses to leave a guest overpaid", async () => {
    const h = await setupHotel("Early Departure");
    const r = await book(h); // D1 → D4
    await h.as(D1, () => svc.desk().checkIn(r.id, {}, h.hotel.ownerId));
    // Prepaid in full (3 nights = 13,680), then leaves after one night.
    await h.as(D1, () =>
      svc
        .billing()
        .collectPayment(
          r.id,
          { method: "card", amount: 13680, idempotencyKey: idem() },
          h.hotel.ownerId,
        ),
    );
    await expect(
      h.as(D2, () => svc.desk().checkOut(r.id, {}, h.hotel.ownerId)),
    ).rejects.toMatchObject({
      code: "checkout.refund_due",
    });

    const h2 = await setupHotel("Early Departure 2");
    const r2 = await book(h2);
    await h2.as(D1, () => svc.desk().checkIn(r2.id, {}, h2.hotel.ownerId));
    const out = await h2.as(D2, () =>
      svc
        .desk()
        .checkOut(
          r2.id,
          { payment: { method: "cash", amount: 4560, idempotencyKey: idem() } },
          h2.hotel.ownerId,
        ),
    );
    const invoice = await h2.as(D2, () => svc.billing().invoice(out.invoiceId));
    expect(invoice).toMatchObject({ subtotal: 4000, tax: 560, total: 4560 });
    // The released nights can be sold again on the same room.
    await expect(book(h2, { arrival: D2, departure: D4 })).resolves.toMatchObject({
      roomId: h2.roomIds[0],
    });
  });

  it("extends an in-house stay on the same room, unless someone else holds it", async () => {
    const h = await setupHotel("Extend Hotel");
    const r = await book(h, { arrival: D1, departure: D2 });
    await h.as(D1, () => svc.desk().checkIn(r.id, {}, h.hotel.ownerId));
    const extended = await h.as(D1, () => svc.desk().extendStay(r.id, D3, h.hotel.ownerId));
    expect(extended).toMatchObject({ departure: D3, nights: 2, total: 8000 });
    const folio = await h.as(D1, () => svc.billing().folio(r.id));
    expect(folio.totals).toMatchObject({ charges: 8000, tax: 1120 });

    await book(h, { arrival: D3, departure: D4 });
    await expect(
      h.as(D1, () => svc.desk().extendStay(r.id, D4, h.hotel.ownerId)),
    ).rejects.toMatchObject({
      code: "extend.room_booked",
    });
  });

  describe("payments", () => {
    it("is idempotent per key, refuses overpayment, and records a provider decline", async () => {
      const h = await setupHotel("Payments Hotel");
      const r = await book(h); // expected 13,680
      const k = idem();
      const a = await h.as(D1, () =>
        svc
          .billing()
          .collectPayment(
            r.id,
            { method: "card", amount: 1000, idempotencyKey: k },
            h.hotel.ownerId,
          ),
      );
      const b = await h.as(D1, () =>
        svc
          .billing()
          .collectPayment(
            r.id,
            { method: "card", amount: 1000, idempotencyKey: k },
            h.hotel.ownerId,
          ),
      );
      expect(b.id).toBe(a.id);
      await expect(
        h.as(D1, () =>
          svc
            .billing()
            .collectPayment(
              r.id,
              { method: "card", amount: 99999, idempotencyKey: idem() },
              h.hotel.ownerId,
            ),
        ),
      ).rejects.toMatchObject({ code: "payment.exceeds_balance" });

      const provider = get<PaymentProvider>(app, PAYMENT_PROVIDER);
      const original = provider.charge.bind(provider);
      provider.charge = async () => ({
        status: "failed",
        providerReference: null,
        failureReason: "Card declined",
      });
      try {
        const declined = await h.as(D1, () =>
          svc
            .billing()
            .collectPayment(
              r.id,
              { method: "online", amount: 500, idempotencyKey: idem() },
              h.hotel.ownerId,
            ),
        );
        expect(declined).toMatchObject({ status: "failed", failureReason: "Card declined" });
      } finally {
        provider.charge = original;
      }
      const folio = await h.as(D1, () => svc.billing().folio(r.id));
      expect(folio.totals).toMatchObject({ paid: 1000, balance: 12680 });
    });

    it("two simultaneous payments of the full balance: only one goes through", async () => {
      const h = await setupHotel("Race Payments");
      const r = await book(h);
      const results = await Promise.allSettled(
        [1, 2].map(() =>
          h.as(D1, () =>
            svc
              .billing()
              .collectPayment(
                r.id,
                { method: "card", amount: 13680, idempotencyKey: idem() },
                h.hotel.ownerId,
              ),
          ),
        ),
      );
      expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
      expect(results.find((x) => x.status === "rejected")).toMatchObject({
        reason: expect.objectContaining({ code: "payment.exceeds_balance" }),
      });
      const rows = await ownerQuery<{ n: string }>(
        `SELECT count(*)::text AS n FROM hotel_payments WHERE reservation_id = $1 AND status = 'completed'`,
        [r.id],
      );
      expect(rows[0]!.n).toBe("1");
    });
  });

  describe("permissions", () => {
    it("housekeepers work only their own tasks and can't inspect", async () => {
      const h = await setupHotel("HK Perms", 1);
      const r = await book(h, { arrival: D1, departure: D2 });
      await h.as(D1, () => svc.desk().checkIn(r.id, {}, h.hotel.ownerId));
      const out = await h.as(D2, () =>
        svc
          .desk()
          .checkOut(
            r.id,
            { payment: { method: "cash", amount: 4560, idempotencyKey: idem() } },
            h.hotel.ownerId,
          ),
      );
      const hassan = await seedStaff(app, h.hotel, "housekeeping", "Hassan Ali");
      const salma = await seedStaff(app, h.hotel, "housekeeping", "Salma Mahmoud");
      await h.as(D2, () =>
        svc.housekeeping().assign(out.housekeepingTaskId, hassan.userId, h.hotel.ownerId),
      );
      await expect(
        runAsOf(D2, () =>
          asUser(salma.userId, h.hotel.orgId, () =>
            svc.housekeeping().start(out.housekeepingTaskId, salma.userId),
          ),
        ),
      ).rejects.toMatchObject({ code: "housekeeping.not_your_task" });
      await runAsOf(D2, () =>
        asUser(hassan.userId, h.hotel.orgId, () =>
          svc.housekeeping().start(out.housekeepingTaskId, hassan.userId),
        ),
      );
      await runAsOf(D2, () =>
        asUser(hassan.userId, h.hotel.orgId, () =>
          svc.housekeeping().complete(out.housekeepingTaskId, "Done", hassan.userId),
        ),
      );
      await expect(
        runAsOf(D2, () =>
          asUser(hassan.userId, h.hotel.orgId, () =>
            svc.housekeeping().inspect(out.housekeepingTaskId, hassan.userId),
          ),
        ),
      ).rejects.toMatchObject({ code: "housekeeping.supervisor_only" });
    });

    it("HTTP: accountants take payments but can't check in; housekeeping can't take payments", async () => {
      const h = await setupHotel("HTTP Perms", 1);
      const r = await book(h, { arrival: "2026-10-01", departure: "2026-10-02" });
      const accountant = await seedStaff(app, h.hotel, "accountant", "Dina Samir");
      const maid = await seedStaff(app, h.hotel, "housekeeping", "Hassan Ali");
      const at = await loginAs(http, accountant.email);
      const mt = await loginAs(http, maid.email);
      const checkIn = await http.inject({
        method: "POST",
        url: `/api/hotel/reservations/${r.id}/check-in`,
        headers: { authorization: `Bearer ${at}` },
        payload: {},
      });
      expect(checkIn.statusCode).toBe(403);
      const pay = await http.inject({
        method: "POST",
        url: `/api/hotel/reservations/${r.id}/payments`,
        headers: { authorization: `Bearer ${at}`, "idempotency-key": "http-key-accountant-1" },
        payload: { method: "bank_transfer", amount: 1000 },
      });
      expect(pay.statusCode).toBe(201);
      const maidPay = await http.inject({
        method: "POST",
        url: `/api/hotel/reservations/${r.id}/payments`,
        headers: { authorization: `Bearer ${mt}` },
        payload: { method: "cash", amount: 10 },
      });
      expect(maidPay.statusCode).toBe(403);
    });
  });

  it("builds the desk's day: arrivals with room readiness and balances, departures, in house", async () => {
    const h = await setupHotel("Desk Board", 2);
    const arriving = await book(h, { arrival: "2026-10-01", departure: "2026-10-03" });
    const board = await h.as("2026-10-01", () => svc.desk().today());
    expect(board.arrivals.map((a) => a.id)).toEqual([arriving.id]);
    expect(board.arrivals[0]).toMatchObject({
      folio: { total: 9120, paid: 0, balance: 9120, paymentStatus: "pending" },
      room: { ready: true },
    });
    await h.as("2026-10-01", () => svc.desk().checkIn(arriving.id, {}, h.hotel.ownerId));
    const later = await h.as("2026-10-03", () => svc.desk().today());
    expect(later.departures.map((d) => d.id)).toEqual([arriving.id]);
    expect(later.inHouse).toHaveLength(1);
  });
});
