/**
 * Promo codes through the real HTTP stack: an organizer defines a code, a guest previews and applies it while booking,
 * the discount is frozen onto the booking, limits and windows hold, and a cancelled booking gives its use back.
 */
import type { TestingModule } from "@nestjs/testing";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Clock } from "@core/kernel/clock.js";
import { createAdmitHttpTestApp, hasTestDb, loginAs, seedOrganizer, type SeededOrganizer } from "./helpers.js";

const T0 = Date.parse("2026-10-20T08:00:00.000Z");
const clock: Clock = { now: () => new Date(T0) };
const inDays = (n: number) => new Date(T0 + n * 86_400_000).toISOString();

type Json = Record<string, any>;

describe.skipIf(!hasTestDb)("Admit promo codes", () => {
  let app: TestingModule;
  let http: NestFastifyApplication;
  let org: SeededOrganizer;
  let owner: string;
  let eventId: string;
  let generalId: string;
  let seq = 0;
  let ipSeq = 1;

  const call = async (
    method: "GET" | "POST" | "PATCH" | "DELETE",
    url: string,
    opts: { token?: string; body?: unknown; headers?: Record<string, string> } = {},
  ) => {
    const res = await http.inject({
      method,
      url: `/api${url}`,
      payload: opts.body as never,
      headers: {
        "x-forwarded-for": `10.9.${(ipSeq >> 8) & 255}.${ipSeq++ & 255}`,
        ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.headers ?? {}),
      },
    });
    const ct = String(res.headers["content-type"] ?? "");
    return { status: res.statusCode, body: (ct.includes("json") && res.body ? res.json() : {}) as Json };
  };

  const pub = (path: string) => `/admit/public/${org.slug}${path}`;
  const idem = () => `idem-${Date.now()}-${seq++}-xxxxxxxx`;
  const customer = (n: number) => ({ name: "Promo Customer", email: `promo${n}@example.com`, phone: "010 1234 5678" });
  const items = (quantity = 1) => [{ ticketTypeId: generalId, quantity }];

  const book = (promoCode: string | undefined, n = 1, quantity = 1) =>
    call("POST", pub("/events/promo-night/bookings"), {
      body: { items: items(quantity), customer: customer(n), policyAck: true, ...(promoCode !== undefined ? { promoCode } : {}) },
      headers: { "idempotency-key": idem() },
    });
  const preview = (code: string, quantity = 1) => call("POST", pub("/events/promo-night/promo"), { body: { code, items: items(quantity) } });
  const createCode = (body: Json) => call("POST", `/admit/events/${eventId}/promo-codes`, { token: owner, body });
  const keyOf = (links: { status: string }) => new URL(links.status).searchParams.get("k")!;

  beforeAll(async () => {
    const booted = await createAdmitHttpTestApp({ clock });
    app = booted.moduleRef;
    http = booted.http;
    org = await seedOrganizer(app, "Promo Org");
    owner = await loginAs(http, org.ownerEmail);
    const venue = await call("POST", "/admit/venues", { token: owner, body: { name: "Hall", area: "Zamalek", capacity: 200 } });
    const ev = await call("POST", "/admit/events", {
      token: owner,
      body: {
        slug: "promo-night",
        title: "Promo Night",
        category: "Music",
        venueId: venue.body.id,
        startsAt: inDays(10),
        endsAt: inDays(10.2),
        maxPerBooking: 6,
      },
    });
    eventId = ev.body.id;
    generalId = (await call("POST", `/admit/events/${eventId}/ticket-types`, { token: owner, body: { name: "General", priceMinor: 25000, quantity: 100 } }))
      .body.id;
    await call("POST", `/admit/events/${eventId}/payment-methods`, {
      token: owner,
      body: { type: "instapay", label: "InstaPay", recipientName: "Promo Org", identifier: "promo@instapay", instructions: ["Send the exact total"] },
    });
    expect((await call("POST", `/admit/events/${eventId}/publish`, { token: owner })).status).toBe(200);
  }, 180_000);

  afterAll(async () => {
    await http?.close();
  });

  describe("organizer", () => {
    it("creates a code (stored upper-case), lists it with its use count, and refuses a duplicate", async () => {
      const r = await createCode({ code: "earlybird", kind: "percent", value: 20 });
      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({ code: "EARLYBIRD", kind: "percent", value: 20, enabled: true, usedCount: 0 });
      expect((await createCode({ code: "earlybird", kind: "fixed", value: 1000 })).status).toBe(409);
      const list = await call("GET", `/admit/events/${eventId}/promo-codes`, { token: owner });
      expect(list.body.items.map((p: Json) => p.code)).toContain("EARLYBIRD");
    });

    it("rejects a percentage over 99 and an end before the start", async () => {
      expect((await createCode({ code: "TOOMUCH", kind: "percent", value: 100 })).status).toBe(400);
      const r = await createCode({ code: "BACKWARDS", kind: "fixed", value: 500, validFrom: inDays(2), validUntil: inDays(1) });
      expect(r.status).toBe(400);
    });

    it("needs a signed-in organizer", async () => {
      expect((await call("GET", `/admit/events/${eventId}/promo-codes`)).status).toBe(401);
      expect((await call("POST", `/admit/events/${eventId}/promo-codes`, { body: { code: "NOPE", kind: "percent", value: 5 } })).status).toBe(401);
    });
  });

  describe("guest", () => {
    it("previews a percentage code without holding anything, whatever the letter case", async () => {
      await createCode({ code: "SAVE10", kind: "percent", value: 10 });
      const r = await preview("save10", 2);
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ code: "SAVE10", subtotalMinor: 50000, discountMinor: 5000, totalMinor: 45000 });
    });

    it("books with the code: the total is discounted and the booking remembers what it was priced with", async () => {
      const r = await book("SAVE10", 1, 2);
      expect(r.status).toBe(201);
      expect(r.body.totalMinor).toBe(45000);
      expect(r.body.discountMinor).toBe(5000);
      const view = await call("GET", pub(`/bookings/${r.body.ref}?k=${keyOf(r.body.links)}`));
      expect(view.body).toMatchObject({ subtotalMinor: 50000, discountMinor: 5000, totalMinor: 45000, promoCode: "SAVE10" });
    });

    it("leaves a booking without a code at the full price", async () => {
      const r = await book(undefined, 2);
      expect(r.body.totalMinor).toBe(25000);
      expect(r.body.discountMinor).toBe(0);
      const blank = await book("", 3);
      expect(blank.body.totalMinor).toBe(25000);
    });

    it("applies a fixed amount, capped so something is always left to pay", async () => {
      await createCode({ code: "TAKE50", kind: "fixed", value: 5000 });
      expect((await preview("TAKE50")).body).toMatchObject({ discountMinor: 5000, totalMinor: 20000 });
      await createCode({ code: "ALLFREE", kind: "fixed", value: 25000 });
      const r = await preview("ALLFREE");
      expect(r.status).toBe(400);
      expect(r.body.error.code).toBe("admit.promo_invalid");
      expect((await book("ALLFREE", 4)).status).toBe(400);
    });

    it("refuses an unknown, disabled, not-yet-valid or expired code, and books nothing", async () => {
      const unknown = await book("NOSUCHCODE", 5);
      expect(unknown.status).toBe(400);
      expect(unknown.body.error.fields?.[0]?.path ?? unknown.body.error.details?.fields?.[0]?.path).toBe("promoCode");

      const off = (await createCode({ code: "SWITCHEDOFF", kind: "percent", value: 15, enabled: false })).body;
      expect((await preview("SWITCHEDOFF")).status).toBe(400);
      expect((await call("PATCH", `/admit/promo-codes/${off.id}`, { token: owner, body: { enabled: true } })).status).toBe(200);
      expect((await preview("SWITCHEDOFF")).status).toBe(200);

      await createCode({ code: "NEXTWEEK", kind: "percent", value: 5, validFrom: inDays(7) });
      await createCode({ code: "LASTWEEK", kind: "percent", value: 5, validFrom: inDays(-14), validUntil: inDays(-7) });
      expect((await preview("NEXTWEEK")).body.error.message).toMatch(/not valid yet/);
      expect((await preview("LASTWEEK")).body.error.message).toMatch(/expired/);
    });

    it("honours a use limit exactly, and gives the use back when the booking is cancelled", async () => {
      await createCode({ code: "ONLYONE", kind: "percent", value: 50, maxUses: 1 });
      const first = await book("ONLYONE", 6);
      expect(first.status).toBe(201);
      expect((await book("ONLYONE", 7)).status).toBe(400);
      expect((await preview("ONLYONE")).body.error.message).toMatch(/fully used/);

      const list = await call("GET", `/admit/events/${eventId}/promo-codes`, { token: owner });
      expect(list.body.items.find((p: Json) => p.code === "ONLYONE").usedCount).toBe(1);

      const cancel = await call("POST", pub(`/bookings/${first.body.ref}/cancel?k=${keyOf(first.body.links)}`));
      expect(cancel.status).toBe(200);
      expect((await book("ONLYONE", 8)).status).toBe(201);
    });

    it("never lets concurrent guests exceed a use limit", async () => {
      await createCode({ code: "RACE", kind: "percent", value: 10, maxUses: 2 });
      const results = await Promise.all([10, 11, 12, 13, 14].map((n) => book("RACE", n)));
      expect(results.filter((r) => r.status === 201)).toHaveLength(2);
      expect(results.filter((r) => r.status === 400)).toHaveLength(3);
    });
  });

  describe("after the fact", () => {
    it("deleting a code leaves the bookings that used it as they were priced", async () => {
      const made = (await createCode({ code: "GONE", kind: "percent", value: 10 })).body;
      const b = await book("GONE", 20);
      expect(b.status).toBe(201);
      expect((await call("DELETE", `/admit/promo-codes/${made.id}`, { token: owner })).status).toBe(204);
      const view = await call("GET", pub(`/bookings/${b.body.ref}?k=${keyOf(b.body.links)}`));
      expect(view.body).toMatchObject({ promoCode: "GONE", discountMinor: 2500, totalMinor: 22500 });
      expect((await preview("GONE")).status).toBe(400);
    });
  });
});
