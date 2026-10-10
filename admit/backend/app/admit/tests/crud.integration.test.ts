/**
 * The organizer dashboard's create / read / update / delete rules, through the real HTTP stack: what may be removed (venues and
 * draft events nobody depends on), what must stay (the last ticket type and payment method of a published event, anything with
 * bookings), and what a closed event refuses (new payments, ticket issuance).
 */
import type { TestingModule } from "@nestjs/testing";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Clock } from "@core/kernel/clock.js";
import { createAdmitHttpTestApp, hasTestDb, loginAs, seedOrganizer, seedStaff, type SeededOrganizer } from "./helpers.js";

const T0 = Date.parse("2026-10-20T08:00:00.000Z");
const clock: Clock = { now: () => new Date(T0) };
const inDays = (n: number) => new Date(T0 + n * 86_400_000).toISOString();

type Json = Record<string, any>;

describe.skipIf(!hasTestDb)("Admit dashboard CRUD rules", () => {
  let app: TestingModule;
  let http: NestFastifyApplication;
  let org: SeededOrganizer;
  let owner: string;
  let viewer: string;
  let seq = 0;
  let ipSeq = 1;

  const call = async (
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    url: string,
    opts: { token?: string; body?: unknown; headers?: Record<string, string>; raw?: Buffer } = {},
  ) => {
    const res = await http.inject({
      method,
      url: `/api${url}`,
      payload: (opts.raw ?? opts.body) as never,
      headers: {
        "x-forwarded-for": `10.9.${(ipSeq >> 8) & 255}.${ipSeq++ & 255}`,
        ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.headers ?? {}),
      },
    });
    const ct = String(res.headers["content-type"] ?? "");
    return { status: res.statusCode, body: (ct.includes("json") && res.body ? res.json() : {}) as Json };
  };

  const eventBody = (slug: string, venueId: string) => ({
    slug,
    title: `Event ${slug}`,
    category: "Test",
    venueId,
    startsAt: inDays(10),
    endsAt: inDays(10.2),
  });
  const methodBody = { type: "instapay", label: "InstaPay", recipientName: "CRUD Org", identifier: "crud@instapay", instructions: ["Send the exact total"] };

  const newVenue = async (name = `Hall ${seq++}`) =>
    (await call("POST", "/admit/venues", { token: owner, body: { name, area: "Zamalek", capacity: 100 } })).body.id as string;

  /** A published event with one ticket type and one payment method. */
  async function publishedEvent(slug: string) {
    const venueId = await newVenue();
    const ev = await call("POST", "/admit/events", { token: owner, body: eventBody(slug, venueId) });
    const eventId = ev.body.id as string;
    const typeId = (await call("POST", `/admit/events/${eventId}/ticket-types`, { token: owner, body: { name: "General", priceMinor: 10000, quantity: 20 } }))
      .body.id as string;
    const methodId = (await call("POST", `/admit/events/${eventId}/payment-methods`, { token: owner, body: methodBody })).body.id as string;
    expect((await call("POST", `/admit/events/${eventId}/publish`, { token: owner })).status).toBe(200);
    return { venueId, eventId, typeId, methodId };
  }

  const book = (slug: string, typeId: string, n: number) =>
    call("POST", `/admit/public/${org.slug}/events/${slug}/bookings`, {
      body: {
        items: [{ ticketTypeId: typeId, quantity: 1 }],
        customer: { name: "Test Customer", email: `crud${n}@example.com`, phone: "010 1234 5678" },
        policyAck: true,
      },
      headers: { "idempotency-key": `crud-key-${Date.now()}-${n}-xxxxxxxx` },
    });
  const keyOf = (links: { status: string }) => new URL(links.status).searchParams.get("k")!;

  beforeAll(async () => {
    const booted = await createAdmitHttpTestApp({ clock });
    app = booted.moduleRef;
    http = booted.http;
    org = await seedOrganizer(app, "CRUD Org");
    owner = await loginAs(http, org.ownerEmail);
    viewer = await loginAs(http, (await seedStaff(app, org, "viewer", "Viewer")).email);
  }, 120_000);

  afterAll(async () => {
    await http?.close();
  });

  describe("venues", () => {
    it("reads one venue, and a missing one is a 404", async () => {
      const id = await newVenue("Readable Hall");
      expect((await call("GET", `/admit/venues/${id}`, { token: owner })).body).toMatchObject({ id, name: "Readable Hall", capacity: 100 });
      expect((await call("GET", "/admit/venues/vnu_missing", { token: owner })).status).toBe(404);
    });

    it("deletes an unused venue but refuses one that an event still uses", async () => {
      const unused = await newVenue();
      expect((await call("DELETE", `/admit/venues/${unused}`, { token: owner })).status).toBe(204);
      expect((await call("GET", `/admit/venues/${unused}`, { token: owner })).status).toBe(404);

      const used = await newVenue();
      await call("POST", "/admit/events", { token: owner, body: eventBody("uses-venue", used) });
      const refused = await call("DELETE", `/admit/venues/${used}`, { token: owner });
      expect(refused.status).toBe(409);
      expect(refused.body.error.code).toBe("admit.venue_in_use");
    });

    it("needs the update permission", async () => {
      const id = await newVenue();
      expect((await call("DELETE", `/admit/venues/${id}`, { token: viewer })).status).toBe(403);
      expect((await call("GET", `/admit/venues/${id}`, { token: viewer })).status).toBe(200);
    });
  });

  describe("deleting events", () => {
    it("removes a draft nobody has booked, with its ticket types and methods", async () => {
      const venueId = await newVenue();
      const ev = await call("POST", "/admit/events", { token: owner, body: eventBody("draft-delete", venueId) });
      await call("POST", `/admit/events/${ev.body.id}/ticket-types`, { token: owner, body: { name: "General", priceMinor: 100, quantity: 5 } });
      expect((await call("DELETE", `/admit/events/${ev.body.id}`, { token: owner })).status).toBe(204);
      expect((await call("GET", `/admit/events/${ev.body.id}`, { token: owner })).status).toBe(404);
      // the address is free again, and the venue can now go too
      expect((await call("POST", "/admit/events", { token: owner, body: eventBody("draft-delete", venueId) })).status).toBe(201);
    });

    it("refuses a published event, and a draft that has bookings", async () => {
      const { eventId, typeId } = await publishedEvent("published-delete");
      const published = await call("DELETE", `/admit/events/${eventId}`, { token: owner });
      expect(published.status).toBe(409);
      expect(published.body.error.code).toBe("admit.event_not_deletable");

      expect((await book("published-delete", typeId, 1)).status).toBe(201);
      expect((await call("POST", `/admit/events/${eventId}/unpublish`, { token: owner })).status).toBe(200);
      const booked = await call("DELETE", `/admit/events/${eventId}`, { token: owner });
      expect(booked.status).toBe(409);
      expect(booked.body.error.code).toBe("admit.event_has_bookings");
    });

    it("needs the update permission", async () => {
      const venueId = await newVenue();
      const ev = await call("POST", "/admit/events", { token: owner, body: eventBody("viewer-delete", venueId) });
      expect((await call("DELETE", `/admit/events/${ev.body.id}`, { token: viewer })).status).toBe(403);
    });
  });

  describe("a published event stays buyable", () => {
    it("keeps at least one ticket type on sale", async () => {
      const { eventId, typeId } = await publishedEvent("keeps-type");
      for (const attempt of [
        () => call("DELETE", `/admit/ticket-types/${typeId}`, { token: owner }),
        () => call("PATCH", `/admit/ticket-types/${typeId}`, { token: owner, body: { onSale: false } }),
        () => call("PATCH", `/admit/ticket-types/${typeId}`, { token: owner, body: { quantity: 0 } }),
      ]) {
        const r = await attempt();
        expect(r.status).toBe(409);
        expect(r.body.error.code).toBe("admit.last_ticket_type");
      }
      // with a second type on sale the first may go
      await call("POST", `/admit/events/${eventId}/ticket-types`, { token: owner, body: { name: "VIP", priceMinor: 50000, quantity: 5 } });
      expect((await call("DELETE", `/admit/ticket-types/${typeId}`, { token: owner })).status).toBe(204);
    });

    it("keeps at least one enabled payment method", async () => {
      const { eventId, methodId } = await publishedEvent("keeps-method");
      for (const attempt of [
        () => call("DELETE", `/admit/payment-methods/${methodId}`, { token: owner }),
        () => call("PATCH", `/admit/payment-methods/${methodId}`, { token: owner, body: { enabled: false } }),
      ]) {
        const r = await attempt();
        expect(r.status).toBe(409);
        expect(r.body.error.code).toBe("admit.last_payment_method");
      }
      await call("POST", `/admit/events/${eventId}/payment-methods`, { token: owner, body: { ...methodBody, label: "Wallet", type: "wallet" } });
      expect((await call("PATCH", `/admit/payment-methods/${methodId}`, { token: owner, body: { enabled: false } })).status).toBe(200);
    });

    it("lets a draft lose them freely", async () => {
      const venueId = await newVenue();
      const ev = await call("POST", "/admit/events", { token: owner, body: eventBody("draft-free", venueId) });
      const t = await call("POST", `/admit/events/${ev.body.id}/ticket-types`, { token: owner, body: { name: "General", priceMinor: 100, quantity: 5 } });
      const m = await call("POST", `/admit/events/${ev.body.id}/payment-methods`, { token: owner, body: methodBody });
      expect((await call("DELETE", `/admit/ticket-types/${t.body.id}`, { token: owner })).status).toBe(204);
      expect((await call("DELETE", `/admit/payment-methods/${m.body.id}`, { token: owner })).status).toBe(204);
    });
  });

  describe("a closed event takes no more money", () => {
    it("rejects a proof upload and an approval once the organizer cancelled the event", async () => {
      const { eventId, typeId, methodId } = await publishedEvent("closed-event");
      const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
      const proofFlow = async (ref: string, k: string) => {
        const pre = await call("POST", `/admit/public/${org.slug}/bookings/${ref}/proof/presign?k=${k}`, {
          body: { fileName: "r.png", contentType: "image/png", byteSize: png.length },
        });
        if (pre.status !== 201) return { pre };
        const put = await call("PUT", pre.body.upload.url.replace(/^\/api/, ""), { raw: png, headers: { "content-type": "application/octet-stream" } });
        expect(put.status).toBe(204);
        return {
          pre,
          submit: await call("POST", `/admit/public/${org.slug}/bookings/${ref}/proof?k=${k}`, {
            body: { fileId: pre.body.fileId, methodId, transactionId: "TXN12345" },
          }),
        };
      };

      // one booking already in review, one still waiting for payment
      const inReview = (await book("closed-event", typeId, 10)).body;
      expect((await proofFlow(inReview.ref, keyOf(inReview.links))).submit?.status).toBe(201);
      const waiting = (await book("closed-event", typeId, 11)).body;

      expect((await call("POST", `/admit/events/${eventId}/cancel`, { token: owner })).status).toBe(200);

      const late = await proofFlow(waiting.ref, keyOf(waiting.links));
      expect(late.pre.status).toBe(409);
      expect(late.pre.body.error.code).toBe("admit.event_closed");

      const queue = await call("GET", "/admit/payments", { token: owner });
      const item = (queue.body.items as Json[]).find((i) => i.bookingRef === inReview.ref)!;
      const approve = await call("POST", `/admit/payments/${item.submissionId}/approve`, {
        token: owner,
        body: { version: item.version, idempotencyKey: `crud-approve-${seq++}-xxxxxxxx` },
      });
      expect(approve.status).toBe(409);
      expect(approve.body.error.code).toBe("admit.event_closed");
    });
  });

  describe("the owner manages the team", () => {
    const team = async () => (await call("GET", "/admit/team", { token: owner })).body.members as Json[];
    const newcomer = () => `newcomer+${Date.now()}-${seq++}@admit.test`;

    it("creates an account for a new person and gives them a role in one step", async () => {
      const email = newcomer();
      const without = await call("POST", "/admit/team", { token: owner, body: { email, roleKey: "door_staff" } });
      expect(without.status).toBe(404);
      expect(without.body.error.code).toBe("admit.no_account");

      const weak = await call("POST", "/admit/team", {
        token: owner,
        body: { email, roleKey: "door_staff", account: { name: "Door Person", password: "short" } },
      });
      expect(weak.status).toBe(400);

      const ok = await call("POST", "/admit/team", {
        token: owner,
        body: { email, roleKey: "door_staff", account: { name: "Door Person", password: "a-starting-password-1" } },
      });
      expect(ok.status).toBe(204);
      const member = (await team()).find((m) => m.email === email)!;
      expect(member).toMatchObject({ name: "Door Person" });
      expect(member.roles.map((r: Json) => r.key)).toEqual(["door_staff"]);

      // the person can sign in with the password the owner chose, and sees the role they were given
      const token = await loginAs(http, email, "a-starting-password-1");
      const me = await call("GET", "/admit/me", { token });
      expect(me.status).toBe(200);
      expect(me.body.permissions).toContain("scan:checkin");
      expect(me.body.permissions).not.toContain("approve:payment");
    });

    it("still adds an existing account without needing a password", async () => {
      const existing = await seedStaff(app, org, "viewer", "Already Here");
      const r = await call("POST", "/admit/team", { token: owner, body: { email: existing.email, roleKey: "event_manager" } });
      expect(r.status).toBe(204);
      expect(
        (await team())
          .find((m) => m.email === existing.email)!
          .roles.map((x: Json) => x.key)
          .sort(),
      ).toEqual(["event_manager", "viewer"]);
    });

    it("removes a person entirely: roles, event assignments and membership", async () => {
      const email = newcomer();
      await call("POST", "/admit/team", {
        token: owner,
        body: { email, roleKey: "door_staff", account: { name: "Temp Staff", password: "a-starting-password-1" } },
      });
      const member = (await team()).find((m) => m.email === email)!;
      const { venueId, eventId } = await publishedEvent("team-remove");
      expect((await call("PUT", `/admit/events/${eventId}/staff/${member.userId}`, { token: owner, body: { gate: "B" } })).status).toBe(200);
      expect(venueId).toBeTruthy();

      expect((await call("DELETE", `/admit/team/${member.userId}`, { token: owner })).status).toBe(204);
      expect((await team()).some((m) => m.userId === member.userId)).toBe(false);
      const staff = await call("GET", `/admit/events/${eventId}/staff`, { token: owner });
      expect((staff.body.items as Json[]).some((s) => s.userId === member.userId)).toBe(false);
      expect((await call("DELETE", `/admit/team/${member.userId}`, { token: owner })).status).toBe(404);
    });

    it("is for owners only", async () => {
      const manager = await loginAs(http, (await seedStaff(app, org, "event_manager", "Manager")).email);
      expect(
        (
          await call("POST", "/admit/team", {
            token: manager,
            body: { email: newcomer(), roleKey: "viewer", account: { name: "Nobody Here", password: "a-starting-password-1" } },
          })
        ).status,
      ).toBe(403);
      expect((await call("DELETE", `/admit/team/${org.ownerId}`, { token: manager })).status).toBe(403);
    });

    it("never lets the organizer lock itself out", async () => {
      const self = await call("DELETE", `/admit/team/${org.ownerId}`, { token: owner });
      expect(self.status).toBe(409);
      expect(self.body.error.code).toBe("admit.cannot_remove_self");

      // a second owner may remove the first, but then the remaining one is the last
      const second = await seedStaff(app, org, "owner", "Second Owner");
      const secondToken = await loginAs(http, second.email);
      expect((await call("DELETE", `/admit/team/${org.ownerId}`, { token: secondToken })).status).toBe(204);
      const last = await call("DELETE", `/admit/team/${second.userId}/roles/owner`, { token: secondToken });
      expect(last.status).toBe(409);
      expect(last.body.error.code).toBe("admit.last_owner");
      owner = secondToken; // the original owner is gone; keep going as the remaining one
    });
  });
});
