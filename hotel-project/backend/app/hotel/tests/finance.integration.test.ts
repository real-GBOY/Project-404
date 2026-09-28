/**
 * Slice 5 — finance: refunds as ledger rows (only ever returning a credit, never more than was
 * paid on a payment, idempotent, race-safe), refunds as part of an early check-out, invoice
 * void + re-issue, and the payments ledger / balances / summary read models.
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
const TODAY = "2026-10-01";
let keySeq = 0;
const key = (label: string) => `${label}-${Date.now()}-${keySeq++}`;

describe.skipIf(!hasTestDb)("HotelOS finance (Slice 5)", () => {
  let app: TestingModule;
  let http: NestFastifyApplication;
  const svc = {
    reservations: () => get<ReservationsService>(app, ReservationsService),
    desk: () => get<FrontDeskService>(app, FrontDeskService),
    billing: () => get<BillingService>(app, BillingService),
  };

  interface Hotel {
    hotel: SeededHotel;
    typeId: string;
    roomIds: string[];
    guestId: string;
    as: <T>(date: string, fn: () => Promise<T>) => Promise<T>;
  }

  async function setupHotel(name: string, rooms = 1): Promise<Hotel> {
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
            await get<RoomsService>(app, RoomsService).create(
              { number: `40${i}`, floor: 4, roomTypeId: type.id },
              hotel.ownerId,
            )
          ).id,
        );
      }
      const guest = await get<GuestsService>(app, GuestsService).create(
        {
          fullName: "Nourhan Adel",
          phone: "+20 100 222 3333",
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

  const book = (h: Hotel, arrival: string, departure: string, roomId?: string) =>
    h.as(TODAY, () =>
      svc.reservations().create(
        {
          guestId: h.guestId,
          roomTypeId: h.typeId,
          roomId: roomId ?? null,
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

  const pay = (h: Hotel, id: string, amount: number, date = TODAY) =>
    h.as(date, () =>
      svc
        .billing()
        .collectPayment(
          id,
          { method: "card", amount, idempotencyKey: key("pay") },
          h.hotel.ownerId,
        ),
    );

  const folio = (h: Hotel, id: string, date = TODAY) => h.as(date, () => svc.billing().folio(id));

  beforeAll(async () => {
    const booted = await createHotelHttpTestApp({ clock });
    app = booted.moduleRef;
    http = booted.http;
  }, 120_000);

  afterAll(async () => {
    await http?.close();
  });

  describe("refunds", () => {
    it("returns a cancelled booking's deposit — once, and never more than the credit", async () => {
      const h = await setupHotel("Refund Cancelled");
      const r = await book(h, "2026-10-05", "2026-10-07");
      await pay(h, r.id, 2000);
      await h.as(TODAY, () => svc.reservations().cancel(r.id, "Plans changed", h.hotel.ownerId));

      const before = await folio(h, r.id);
      expect(before.totals).toMatchObject({ total: 0, paid: 2000, balance: -2000 });
      expect(before.credit).toBe(2000);

      const refund = (amount: number, k: string) =>
        h.as(TODAY, () =>
          svc
            .billing()
            .refund(
              r.id,
              { amount, reason: "Deposit returned", idempotencyKey: k },
              h.hotel.ownerId,
            ),
        );
      await expect(refund(2500, key("too-much"))).rejects.toMatchObject({
        code: "refund.exceeds_credit",
      });
      const k = key("deposit");
      const first = await refund(2000, k);
      expect(first).toHaveLength(1);
      expect(first[0]).toMatchObject({ status: "completed", amount: 2000, method: "card" });

      // A retry with the same key hands back the same refund — no second payout.
      const replay = await refund(2000, k);
      expect(replay.map((f) => f.id)).toEqual(first.map((f) => f.id));

      const after = await folio(h, r.id);
      expect(after.totals).toMatchObject({
        paid: 0,
        refunded: 2000,
        balance: 0,
        paymentStatus: "refunded",
      });
      expect(after.credit).toBe(0);
      await expect(refund(1, key("again"))).rejects.toMatchObject({
        code: "refund.exceeds_credit",
      });
    });

    it("refuses anything but a credit — a confirmed booking's deposit isn't refundable until cancelled", async () => {
      const h = await setupHotel("Refund Not Credit");
      const r = await book(h, "2026-10-05", "2026-10-06");
      await pay(h, r.id, 1000);
      await expect(
        h.as(TODAY, () =>
          svc
            .billing()
            .refund(
              r.id,
              { amount: 1000, reason: "Asked for it back", idempotencyKey: key("nc") },
              h.hotel.ownerId,
            ),
        ),
      ).rejects.toMatchObject({ code: "refund.exceeds_credit" });
    });

    it("splits a refund across payments, newest first, never past what each can return", async () => {
      const h = await setupHotel("Refund Split");
      const r = await book(h, "2026-10-05", "2026-10-06");
      await pay(h, r.id, 1000);
      await pay(h, r.id, 1500);
      await h.as(TODAY, () => svc.reservations().cancel(r.id, null, h.hotel.ownerId));
      const payments = (await folio(h, r.id)).payments;
      const k = key("split");
      const rows = await h.as(TODAY, () =>
        svc
          .billing()
          .refund(r.id, { amount: 2000, reason: "Cancelled", idempotencyKey: k }, h.hotel.ownerId),
      );
      expect(rows.map((f) => [f.paymentId, f.amount, f.idempotencyKey])).toEqual([
        [payments[1]!.id, 1500, `${k}#1`],
        [payments[0]!.id, 500, `${k}#2`],
      ]);
      const after = await folio(h, r.id);
      expect(after.payments.map((p) => p.refundable)).toEqual([500, 0]);
      expect(after.credit).toBe(500);
    });

    it("lets only one of two simultaneous refunds of the whole credit through", async () => {
      const h = await setupHotel("Refund Race");
      const r = await book(h, "2026-10-05", "2026-10-06");
      await pay(h, r.id, 3000);
      await h.as(TODAY, () => svc.reservations().cancel(r.id, null, h.hotel.ownerId));
      const results = await Promise.allSettled(
        [key("race-a"), key("race-b")].map((k) =>
          h.as(TODAY, () =>
            svc
              .billing()
              .refund(r.id, { amount: 3000, reason: "Race", idempotencyKey: k }, h.hotel.ownerId),
          ),
        ),
      );
      expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
      const rejected = results.find((x) => x.status === "rejected") as PromiseRejectedResult;
      expect(rejected.reason).toMatchObject({ code: "refund.exceeds_credit" });
      expect((await folio(h, r.id)).totals).toMatchObject({ refunded: 3000, balance: 0 });
    });
  });

  describe("check-out with a credit", () => {
    it("an early departure that leaves the guest in credit refunds it and checks out in one step", async () => {
      const h = await setupHotel("Early Refund");
      const r = await book(h, TODAY, "2026-10-04", h.roomIds[0]);
      await h.as(TODAY, () => svc.desk().checkIn(r.id, {}, h.hotel.ownerId));
      await pay(h, r.id, 17100); // 3 nights × 5,000 + 14% VAT, paid up front
      const receptionist = await seedStaff(app, h.hotel, "receptionist", "Rania Kamal");
      const asDesk = <T>(userId: string, fn: () => Promise<T>) =>
        runAsOf("2026-10-02", () => asUser(userId, h.hotel.orgId, fn));

      // Leaving after one night: two nights (11,400 with VAT) are owed back.
      await expect(
        asDesk(h.hotel.ownerId, () => svc.desk().checkOut(r.id, {}, h.hotel.ownerId)),
      ).rejects.toMatchObject({ code: "checkout.refund_due", details: { balance: -11400 } });
      await expect(
        asDesk(receptionist.userId, () =>
          svc.desk().checkOut(r.id, { refund: { idempotencyKey: key("rc") } }, receptionist.userId),
        ),
      ).rejects.toMatchObject({ code: "refund.not_allowed" });

      const out = await asDesk(h.hotel.ownerId, () =>
        svc.desk().checkOut(r.id, { refund: { idempotencyKey: key("co") } }, h.hotel.ownerId),
      );
      expect(out).toMatchObject({ refunded: true, reservation: { status: "checked_out" } });
      const f = await folio(h, r.id, "2026-10-02");
      expect(f.totals).toMatchObject({ total: 5700, paid: 5700, refunded: 11400, balance: 0 });
      expect(f.refunds).toHaveLength(1);
      expect(f.refunds[0]).toMatchObject({ amount: 11400, status: "completed" });
      const invoice = await h.as("2026-10-02", () => svc.billing().invoice(out.invoiceId));
      expect(invoice.total).toBe(5700);
    });
  });

  describe("invoices", () => {
    it("voids an invoice with a reason, frees its charges for correction, and re-issues once square", async () => {
      const h = await setupHotel("Invoice Void");
      const r = await book(h, TODAY, "2026-10-02", h.roomIds[0]);
      await h.as(TODAY, () => svc.desk().checkIn(r.id, {}, h.hotel.ownerId));
      await h.as(TODAY, () =>
        svc
          .billing()
          .postCharge(
            r.id,
            { kind: "minibar", description: "Minibar", quantity: 1, unitPrice: 300 },
            h.hotel.ownerId,
          ),
      );
      await pay(h, r.id, 6042); // 5,300 + 14% VAT
      const out = await h.as("2026-10-02", () => svc.desk().checkOut(r.id, {}, h.hotel.ownerId));
      const minibar = (await folio(h, r.id, "2026-10-02")).charges.find(
        (c) => c.kind === "minibar",
      )!;

      // Invoiced charges are frozen…
      await expect(
        h.as("2026-10-02", () =>
          svc.billing().voidCharge(minibar.id, "Not consumed", h.hotel.ownerId),
        ),
      ).rejects.toMatchObject({ code: "billing.charge_invoiced" });

      // …until the invoice is voided.
      await h.as("2026-10-02", () =>
        svc.billing().voidInvoice(out.invoiceId, "Minibar charged in error", h.hotel.ownerId),
      );
      await h.as("2026-10-02", () =>
        svc.billing().voidCharge(minibar.id, "Not consumed", h.hotel.ownerId),
      );
      // The folio is now in credit (342 = 300 + VAT); a new invoice waits for the refund.
      await expect(
        h.as("2026-10-02", () => svc.billing().reissueInvoice(r.id, h.hotel.ownerId)),
      ).rejects.toMatchObject({ code: "invoice.folio_open" });
      await h.as("2026-10-02", () =>
        svc
          .billing()
          .refund(
            r.id,
            { amount: 342, reason: "Minibar", idempotencyKey: key("mb") },
            h.hotel.ownerId,
          ),
      );
      const { invoiceId } = await h.as("2026-10-02", () =>
        svc.billing().reissueInvoice(r.id, h.hotel.ownerId),
      );
      expect(invoiceId).not.toBe(out.invoiceId);
      const [fresh, old] = await h.as("2026-10-02", () =>
        Promise.all([svc.billing().invoice(invoiceId), svc.billing().invoice(out.invoiceId)]),
      );
      expect(fresh).toMatchObject({ status: "issued", total: 5700 });
      expect(old).toMatchObject({
        status: "void",
        voidReason: "Minibar charged in error",
        total: 6042,
      });
      await expect(
        h.as("2026-10-02", () => svc.billing().reissueInvoice(r.id, h.hotel.ownerId)),
      ).rejects.toMatchObject({ code: "invoice.already_issued" });
      const list = await h.as("2026-10-02", () => svc.billing().invoices({}));
      expect(list.map((i) => i.status).sort()).toEqual(["issued", "void"]);
    });
  });

  it("builds the ledger, balances and summary from payments and refunds", async () => {
    const h = await setupHotel("Finance Views", 2);
    const inHouse = await book(h, TODAY, "2026-10-03", h.roomIds[0]);
    // A deposit taken the day before: it belongs to that business date, not today's takings.
    await pay(h, inHouse.id, 1000, "2026-09-30");
    await h.as(TODAY, () => svc.desk().checkIn(inHouse.id, {}, h.hotel.ownerId));
    await pay(h, inHouse.id, 4000);
    const cancelled = await book(h, "2026-10-10", "2026-10-11", h.roomIds[1]);
    await pay(h, cancelled.id, 1500);
    await h.as(TODAY, () => svc.reservations().cancel(cancelled.id, null, h.hotel.ownerId));
    await h.as(TODAY, () =>
      svc
        .billing()
        .refund(
          cancelled.id,
          { amount: 500, reason: "Partial", idempotencyKey: key("fv") },
          h.hotel.ownerId,
        ),
    );

    const ledger = await h.as(TODAY, () => svc.billing().ledger({}));
    expect(ledger.map((e) => [e.kind, e.amount])).toEqual([
      ["refund", 500],
      ["payment", 1500],
      ["payment", 4000],
      ["payment", 1000],
    ]);
    expect(ledger.at(-1)!.businessDate).toBe("2026-09-30");
    expect(await h.as(TODAY, () => svc.billing().ledger({ kind: "refund" }))).toHaveLength(1);

    const balances = await h.as(TODAY, () => svc.billing().balances());
    expect(
      balances
        .map((b) => [b.code, b.kind, b.balance])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    ).toEqual(
      [
        [inHouse.code, "due", 6400], // 2 × 5,000 + 14% − 1,000 − 4,000
        [cancelled.code, "credit", -1000],
      ].sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    );

    const summary = await h.as(TODAY, () => svc.billing().financeSummary());
    expect(summary).toMatchObject({
      today: { collected: 5500, refunded: 500 },
      month: { collected: 5500, refunded: 500, net: 5000 },
      outstanding: 6400,
      credits: 1000,
      openFolios: 2,
    });

    const summaries = await h.as(TODAY, () =>
      svc.billing().folioSummaries([inHouse.id, cancelled.id]),
    );
    expect(summaries.find((s) => s.reservationId === cancelled.id)).toMatchObject({
      total: 0,
      paid: 1000,
      refunded: 500,
      balance: -1000,
    });
  });

  it("HTTP: finance screens are for finance staff; refunds need create:refund and replay by key", async () => {
    const h = await setupHotel("Finance HTTP");
    const r = await book(h, "2026-10-05", "2026-10-06");
    await pay(h, r.id, 1200);
    await h.as(TODAY, () => svc.reservations().cancel(r.id, null, h.hotel.ownerId));
    const accountant = await seedStaff(app, h.hotel, "accountant", "Dina Samir");
    const receptionist = await seedStaff(app, h.hotel, "receptionist", "Rania Kamal");
    const at = await loginAs(http, accountant.email);
    const rt = await loginAs(http, receptionist.email);

    for (const url of [
      "/api/hotel/payments",
      "/api/hotel/finance/balances",
      "/api/hotel/finance/summary",
    ]) {
      const denied = await http.inject({
        method: "GET",
        url,
        headers: { authorization: `Bearer ${rt}` },
      });
      expect(denied.statusCode).toBe(403);
      const ok = await http.inject({
        method: "GET",
        url,
        headers: { authorization: `Bearer ${at}` },
      });
      expect(ok.statusCode).toBe(200);
    }

    const refund = (token: string, k: string) =>
      http.inject({
        method: "POST",
        url: `/api/hotel/reservations/${r.id}/refunds`,
        headers: { authorization: `Bearer ${token}`, "idempotency-key": k },
        payload: { amount: 1200, reason: "Deposit back" },
      });
    expect((await refund(rt, "http-refund-rt-1")).statusCode).toBe(403);
    const first = await refund(at, "http-refund-at-1");
    expect(first.statusCode).toBe(201);
    const again = await refund(at, "http-refund-at-1");
    expect(again.statusCode).toBe(201);
    expect(again.json().items[0].id).toBe(first.json().items[0].id);
  });
});
