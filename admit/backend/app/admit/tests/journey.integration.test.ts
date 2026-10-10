/**
 * The whole Admit journey through the real HTTP stack: browse, guest checkout under inventory pressure, proof upload,
 * payment review (races, idempotency, rejection and resubmission), ticket issuance, QR rendering, door scans (including the
 * one-admit-per-ticket race), hold expiry, cancellation and tenant isolation.
 */
import pg from "pg";
import type { TestingModule } from "@nestjs/testing";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Clock } from "@core/kernel/clock.js";
import { TEST_DATABASE_URL } from "@core/tests/helpers.js";
import { ticketToken } from "@admit/admit/shared/secrets.js";
import { JobsRunner } from "@admit/admit/jobs/application/jobs-runner.js";
import { createAdmitHttpTestApp, get, hasTestDb, loginAs, seedOrganizer, seedStaff, type SeededOrganizer } from "./helpers.js";

async function ownerQuery<T extends pg.QueryResultRow>(text: string, params: unknown[] = []) {
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    return (await client.query<T>(text, params)).rows;
  } finally {
    await client.end();
  }
}

const T0 = Date.parse("2026-10-20T08:00:00.000Z");
let offsetMs = 0;
const clock: Clock = { now: () => new Date(T0 + offsetMs) };
const inDays = (n: number) => new Date(T0 + n * 86_400_000).toISOString();

type Json = Record<string, any>;

describe.skipIf(!hasTestDb)("Admit journey", () => {
  let app: TestingModule;
  let http: NestFastifyApplication;
  let org: SeededOrganizer;
  let owner: string;
  let reviewer: string;
  let reviewerEmail: string;
  let doorEmail: string;
  let door: string;
  let eventId: string;
  let generalId: string;
  let vipId: string;
  let methodId: string;
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
      // Each request comes from its own client address unless the test pins one (rate limits are per address; ADMIT_TRUSTED_PROXY_HOPS=1 in tests).
      headers: {
        "x-forwarded-for": `10.${(ipSeq >> 16) & 255}.${(ipSeq >> 8) & 255}.${ipSeq++ & 255}`,
        ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.headers ?? {}),
      },
    });
    const ct = String(res.headers["content-type"] ?? "");
    return { status: res.statusCode, body: (ct.includes("json") && res.body ? res.json() : {}) as Json, raw: res.rawPayload, headers: res.headers };
  };

  const pub = (path: string) => `/admit/public/${org.slug}${path}`;
  const customer = (n = 1) => ({ name: `Test Customer ${"abc"[n % 3]}`, email: `cust${n}@example.com`, phone: "010 1234 5678" });
  const idem = () => `idem-${Date.now()}-${seq++}-xxxxxxxx`;

  const book = (items: Array<{ ticketTypeId: string; quantity: number; holderNames?: string[] }>, n = 1, key = idem()) =>
    call("POST", pub("/events/jazz-night/bookings"), { body: { items, customer: customer(n), policyAck: true }, headers: { "idempotency-key": key } });

  const keyOf = (links: { status: string }) => new URL(links.status).searchParams.get("k")!;

  /** Upload proof the way the web app does it: presign -> PUT bytes -> submit. */
  const uploadProof = async (ref: string, k: string, extra: Json = {}) => {
    const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
    const pre = await call("POST", pub(`/bookings/${ref}/proof/presign?k=${k}`), {
      body: { fileName: "receipt.png", contentType: "image/png", byteSize: png.length },
    });
    expect(pre.status).toBe(201);
    const put = await call("PUT", pre.body.upload.url.replace(/^\/api/, ""), { raw: png, headers: { "content-type": "application/octet-stream" } });
    expect(put.status).toBe(204);
    return call("POST", pub(`/bookings/${ref}/proof?k=${k}`), {
      body: { fileId: pre.body.fileId, methodId, transactionId: "TXN12345", sentFrom: "010****678", ...extra },
    });
  };

  const queueItem = async (ref: string) => {
    const q = await call("GET", "/admit/payments", { token: reviewer });
    return (q.body.items as Json[]).find((i) => i.bookingRef === ref);
  };
  const approve = (id: string, version: number, key = idem()) =>
    call("POST", `/admit/payments/${id}/approve`, { token: reviewer, body: { version, idempotencyKey: key } });

  /** The clock moved on (hold expiry), so earlier access tokens have expired: sign in again. */
  const refreshTokens = async () => {
    owner = await loginAs(http, org.ownerEmail);
    reviewer = await loginAs(http, reviewerEmail);
    door = await loginAs(http, doorEmail);
  };

  beforeAll(async () => {
    const booted = await createAdmitHttpTestApp({ clock });
    app = booted.moduleRef;
    http = booted.http;
    org = await seedOrganizer(app, "Journey Org");
    owner = await loginAs(http, org.ownerEmail);
    const rev = await seedStaff(app, org, "finance_reviewer", "Reviewer");
    reviewerEmail = rev.email;
    reviewer = await loginAs(http, rev.email);
    const dr = await seedStaff(app, org, "door_staff", "Door");
    doorEmail = dr.email;
    door = await loginAs(http, dr.email);

    const venue = await call("POST", "/admit/venues", { token: owner, body: { name: "Opera Hall", area: "Zamalek", capacity: 100 } });
    const ev = await call("POST", "/admit/events", {
      token: owner,
      body: {
        slug: "jazz-night",
        title: "Jazz Night",
        category: "Music",
        venueId: venue.body.id,
        startsAt: inDays(10),
        endsAt: inDays(10.2),
        maxPerBooking: 6,
        policies: { refund: "No refunds after approval." },
      },
    });
    eventId = ev.body.id;
    generalId = (await call("POST", `/admit/events/${eventId}/ticket-types`, { token: owner, body: { name: "General", priceMinor: 25000, quantity: 30 } })).body
      .id;
    vipId = (await call("POST", `/admit/events/${eventId}/ticket-types`, { token: owner, body: { name: "VIP", priceMinor: 90000, quantity: 2 } })).body.id;
    methodId = (
      await call("POST", `/admit/events/${eventId}/payment-methods`, {
        token: owner,
        body: {
          type: "instapay",
          label: "InstaPay",
          recipientName: "Journey Org",
          identifier: "journey@instapay",
          instructions: ["Open InstaPay", "Send the exact total"],
        },
      })
    ).body.id;
    expect((await call("POST", `/admit/events/${eventId}/publish`, { token: owner })).status).toBe(200);
    // assign the door person to the event (gate A)
    // Event reach is explicit: the door person works gate A, the reviewer reviews this event.
    for (const [email, gate] of [
      [dr.email, "A"],
      [rev.email, ""],
    ] as const) {
      const u = await ownerQuery<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [email]);
      await ownerQuery(`INSERT INTO admit_event_staff (organization_id, event_id, user_id, gate) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [
        org.orgId,
        eventId,
        u[0]!.id,
        gate,
      ]);
    }
  }, 180_000);

  afterAll(async () => {
    await http?.close();
  });

  describe("catalogue", () => {
    it("shows the published event with availability, never payment details or exact large inventory", async () => {
      const r = await call("GET", pub("/events"));
      expect(r.status).toBe(200);
      expect(r.body.events).toHaveLength(1);
      expect(r.body.events[0]).toMatchObject({ slug: "jazz-night", availability: "available", minPriceMinor: 25000 });
      const d = await call("GET", pub("/events/jazz-night"));
      expect(d.body.ticketTypes.map((t: Json) => [t.name, t.remaining])).toEqual([
        ["General", 30],
        ["VIP", 2],
      ]);
      expect(JSON.stringify(d.body)).not.toContain("journey@instapay");
    });
    it("404s an unknown organizer or event", async () => {
      expect((await call("GET", "/admit/public/nobody/events")).status).toBe(404);
      expect((await call("GET", pub("/events/missing"))).status).toBe(404);
    });
  });

  describe("guest checkout", () => {
    it("validates the form with per-field messages", async () => {
      const r = await call("POST", pub("/events/jazz-night/bookings"), {
        body: { items: [{ ticketTypeId: generalId, quantity: 1 }], customer: { name: "X", email: "nope", phone: "123" }, policyAck: true },
        headers: { "idempotency-key": idem() },
      });
      expect(r.status).toBe(400);
      expect((r.body.error.details.fields as Json[]).map((f) => f.path).sort()).toEqual(["customer.email", "customer.name", "customer.phone"]);
    });

    it("requires the policy acknowledgment when the event has policies, and an Idempotency-Key", async () => {
      const r = await call("POST", pub("/events/jazz-night/bookings"), {
        body: { items: [{ ticketTypeId: generalId, quantity: 1 }], customer: customer(), policyAck: false },
        headers: { "idempotency-key": idem() },
      });
      expect(r.body.error.code).toBe("admit.policy_ack");
      const noKey = await call("POST", pub("/events/jazz-night/bookings"), {
        body: { items: [{ ticketTypeId: generalId, quantity: 1 }], customer: customer(), policyAck: true },
      });
      expect(noKey.body.error.code).toBe("admit.idempotency_key_required");
    });

    it("books, holds the seats and queues the payment-instructions email in the same transaction", async () => {
      const r = await book([{ ticketTypeId: generalId, quantity: 2 }], 1);
      expect(r.status).toBe(201);
      expect(r.body.ref).toMatch(/^ADM-[A-HJ-NP-Z0-9]{4}-[A-HJ-NP-Z0-9]{4}$/);
      expect(r.body.totalMinor).toBe(50000);
      const d = await call("GET", pub("/events/jazz-night"));
      expect(d.body.ticketTypes[0].remaining).toBe(28);
      const mails = await ownerQuery<{ type: string; status: string; to_email: string; payload: Json }>(
        `SELECT type, status, to_email, payload FROM admit_email_messages WHERE booking_id = (SELECT id FROM admit_bookings WHERE ref = $1)`,
        [r.body.ref],
      );
      expect(mails).toHaveLength(1);
      expect(mails[0]).toMatchObject({ type: "INSTRUCTIONS", status: "QUEUED", to_email: "cust1@example.com" });
      expect(mails[0]!.payload.payment_methods[0]).toMatchObject({ label: "InstaPay", identifier: "journey@instapay" });
      expect(mails[0]!.payload.total).toBe("EGP 500.00");
    });

    it("returns the original for a replayed Idempotency-Key instead of booking twice", async () => {
      const key = idem();
      const a = await book([{ ticketTypeId: generalId, quantity: 1 }], 2, key);
      const b = await book([{ ticketTypeId: generalId, quantity: 1 }], 2, key);
      expect(a.status).toBe(201);
      expect(b.status).toBe(200);
      expect(b.body.ref).toBe(a.body.ref);
      const n = await ownerQuery<{ n: string }>(`SELECT count(*)::text n FROM admit_bookings WHERE ref = $1`, [a.body.ref]);
      expect(n[0]!.n).toBe("1");
    });

    it("never oversells: concurrent bookings of the last seats yield exactly as many bookings as seats", async () => {
      const results = await Promise.all(Array.from({ length: 6 }, (_, i) => book([{ ticketTypeId: vipId, quantity: 1 }], 10 + i)));
      const ok = results.filter((r) => r.status === 201);
      const sold = results.filter((r) => r.status === 409);
      expect(ok).toHaveLength(2);
      expect(sold).toHaveLength(4);
      expect(sold[0]!.body.error.code).toBe("admit.sold_out");
      const held = await ownerQuery<{ n: string }>(`SELECT coalesce(sum(quantity),0)::text n FROM admit_booking_lines WHERE ticket_type_id = $1`, [vipId]);
      expect(held[0]!.n).toBe("2");
    });

    it("enforces per-booking limits", async () => {
      const r = await book(
        [
          { ticketTypeId: generalId, quantity: 6 },
          { ticketTypeId: generalId, quantity: 1 },
        ],
        30,
      );
      expect(r.status).toBe(400);
      expect(r.body.error.code).toBe("admit.quantity");
    });
  });

  describe("guest access", () => {
    it("needs the magic-link secret: the public ref alone grants nothing", async () => {
      const r = await book([{ ticketTypeId: generalId, quantity: 1 }], 40);
      const k = keyOf(r.body.links);
      expect((await call("GET", pub(`/bookings/${r.body.ref}`))).status).toBe(400);
      expect((await call("GET", pub(`/bookings/${r.body.ref}?k=${"a".repeat(32)}`))).status).toBe(404);
      const ok = await call("GET", pub(`/bookings/${r.body.ref}?k=${k}`));
      expect(ok.status).toBe(200);
      expect(ok.body).toMatchObject({ status: "AWAITING_PAYMENT", canResubmit: true });
      expect(ok.body.customer.emailMasked).toMatch(/^c\*+@example\.com$/);
      expect(ok.body.paymentMethods[0].identifier).toBe("journey@instapay");
      // a different booking's secret does not open this one
      const other = await book([{ ticketTypeId: generalId, quantity: 1 }], 41);
      expect((await call("GET", pub(`/bookings/${r.body.ref}?k=${keyOf(other.body.links)}`))).status).toBe(404);
    });

    it("lets a customer cancel before paying, which releases the seats", async () => {
      const before = (await call("GET", pub("/events/jazz-night"))).body.ticketTypes[0].remaining;
      const r = await book([{ ticketTypeId: generalId, quantity: 3 }], 42);
      const k = keyOf(r.body.links);
      expect((await call("GET", pub("/events/jazz-night"))).body.ticketTypes[0].remaining).toBe(before - 3);
      const c = await call("POST", pub(`/bookings/${r.body.ref}/cancel?k=${k}`));
      expect(c.status).toBe(200);
      expect(c.body.status).toBe("CANCELLED");
      expect((await call("GET", pub("/events/jazz-night"))).body.ticketTypes[0].remaining).toBe(before);
    });

    it("rate-limits repeated requests from one address with 429 and Retry-After", async () => {
      const pinned = { "x-forwarded-for": "203.0.113.9" };
      const codes: number[] = [];
      for (let i = 0; i < 5; i++)
        codes.push((await call("POST", pub("/links/resend"), { body: { ref: "ADM-ZZZZ-ZZZZ", email: "x@example.com" }, headers: pinned })).status);
      expect(codes).toEqual([202, 202, 202, 429, 429]);
      const limited = await call("POST", pub("/links/resend"), { body: { ref: "ADM-ZZZZ-ZZZZ", email: "x@example.com" }, headers: pinned });
      expect(limited.headers["retry-after"]).toBeTruthy();
    });

    it("answers a link-resend request identically for unknown bookings", async () => {
      const a = await call("POST", pub("/links/resend"), { body: { ref: "ADM-ZZZZ-ZZZZ", email: "x@example.com" } });
      expect(a.status).toBe(202);
      expect(a.body).toEqual({ accepted: true });
    });
  });

  describe("payment, review and issuance", () => {
    let ref: string;
    let k: string;
    let submissionId: string;
    let version: number;

    it("accepts proof, moves the booking IN_REVIEW and queues the receipt email", async () => {
      const r = await book([{ ticketTypeId: generalId, quantity: 2 }], 50);
      ref = r.body.ref;
      k = keyOf(r.body.links);
      const bad = await call("POST", pub(`/bookings/${ref}/proof/presign?k=${k}`), {
        body: { fileName: "x.exe", contentType: "application/x-msdownload", byteSize: 100 },
      });
      expect(bad.body.error.code).toBe("admit.proof_type");
      const big = await call("POST", pub(`/bookings/${ref}/proof/presign?k=${k}`), {
        body: { fileName: "x.png", contentType: "image/png", byteSize: 14 * 1024 * 1024 },
      });
      expect(big.body.error.code).toBe("admit.proof_too_large");
      const up = await uploadProof(ref, k);
      expect(up.status).toBe(201);
      expect(up.body.status).toBe("IN_REVIEW");
      expect((await call("GET", pub(`/bookings/${ref}?k=${k}`))).body.status).toBe("IN_REVIEW");
      const q = await ownerQuery<{ type: string }>(
        `SELECT type FROM admit_email_messages WHERE booking_id = (SELECT id FROM admit_bookings WHERE ref = $1) ORDER BY created_at`,
        [ref],
      );
      expect(q.map((m) => m.type)).toEqual(["INSTRUCTIONS", "PROOF_RECEIVED"]);
    });

    it("refuses a second submission while one is in review, and someone else's file", async () => {
      expect((await uploadProof(ref, k).catch(() => ({ status: 0 }))).status).not.toBe(201);
    });

    it("shows the submission in the queue only to people allowed to review", async () => {
      const item = await queueItem(ref);
      expect(item).toMatchObject({ customer: customer(50).name, amountMinor: 50000, currency: "EGP" });
      submissionId = item!.submissionId;
      version = item!.version;
      expect((await call("GET", "/admit/payments", { token: door })).status).toBe(403);
      expect((await call("GET", `/admit/payments/${submissionId}`, { token: door })).status).toBe(403);
      const d = await call("GET", `/admit/payments/${submissionId}`, { token: reviewer });
      expect(d.body).toMatchObject({ txnId: "TXN12345", bookingStatus: "IN_REVIEW" });
      const proof = await call("GET", `/admit/payments/${submissionId}/proof`, { token: reviewer });
      expect(proof.status).toBe(200);
      expect(proof.headers["cache-control"]).toBe("private, no-store");
    });

    it("applies a soft lock that a second reviewer sees", async () => {
      const mine = await call("POST", `/admit/payments/${submissionId}/claim`, { token: reviewer });
      expect(mine.body.heldByMe).toBe(true);
      const ownerClaim = await call("POST", `/admit/payments/${submissionId}/claim`, { token: owner });
      expect(ownerClaim.body.heldByMe).toBe(false);
      const item = await queueItem(ref);
      expect(item!.lock).toBeTruthy();
    });

    it("cannot be decided by someone without the approve permission", async () => {
      const r = await call("POST", `/admit/payments/${submissionId}/approve`, { token: door, body: { version, idempotencyKey: idem() } });
      expect(r.status).toBe(403);
    });

    it("approves once under concurrent reviewers: one winner, no duplicate tickets, one confirmation email", async () => {
      const key = idem();
      const results = await Promise.all([
        approve(submissionId, version, key),
        approve(submissionId, version, key),
        approve(submissionId, version),
        approve(submissionId, version),
      ]);
      const statuses = results.map((r) => r.status).sort();
      expect(statuses.filter((s) => s === 200).length).toBeGreaterThanOrEqual(1);
      const winners = results.filter((r) => r.status === 200 && r.body.replayed === false);
      expect(winners).toHaveLength(1);
      expect(winners[0]!.body).toMatchObject({ status: "APPROVED", bookingStatus: "CONFIRMED", ticketsIssued: 2 });
      for (const r of results.filter((x) => x.status !== 200)) expect(r.body.error.code).toBe("admit.payment_changed");

      const tickets = await ownerQuery<{ status: string }>(
        `SELECT status FROM admit_tickets WHERE booking_id = (SELECT id FROM admit_bookings WHERE ref = $1)`,
        [ref],
      );
      expect(tickets).toHaveLength(2);
      const mails = await ownerQuery<{ type: string; payload: Json }>(
        `SELECT type, payload FROM admit_email_messages WHERE booking_id = (SELECT id FROM admit_bookings WHERE ref = $1) AND type = 'TICKETS'`,
        [ref],
      );
      expect(mails).toHaveLength(1);
      expect(mails[0]!.payload.ticket_count).toBe(2);
      expect(mails[0]!.payload.tickets).toHaveLength(2);
      expect(mails[0]!.payload.tickets[0].ticket_qr_code_url).toMatch(/\/qr\.png\?k=/);
      expect(JSON.stringify(mails[0]!.payload)).not.toContain(ticketToken(mails[0]!.payload.tickets[0].ticket_id));
    });

    it("never stores QR tokens and never returns them to staff", async () => {
      const t = await ownerQuery<{ id: string; token_hash: string }>(
        `SELECT id, token_hash FROM admit_tickets WHERE booking_id = (SELECT id FROM admit_bookings WHERE ref = $1) LIMIT 1`,
        [ref],
      );
      const token = ticketToken(t[0]!.id);
      expect(t[0]!.token_hash).not.toBe(token);
      expect(t[0]!.token_hash).toHaveLength(64);
      const detail = await call("GET", `/admit/tickets/${t[0]!.id}`, { token: reviewer });
      expect(JSON.stringify(detail.body)).not.toContain(token);
      const bk = await ownerQuery<{ id: string }>(`SELECT id FROM admit_bookings WHERE ref = $1`, [ref]);
      const full = await call("GET", `/admit/bookings/${bk[0]!.id}`, { token: reviewer });
      expect(full.status).toBe(200);
      expect(JSON.stringify(full.body)).not.toContain(token);
      expect(full.body.status).toBe("CONFIRMED");
      expect(full.body.tickets).toHaveLength(2);
    });

    it("serves the customer their tickets and a real PNG QR per ticket", async () => {
      const list = await call("GET", pub(`/bookings/${ref}/tickets?k=${k}`));
      expect(list.status).toBe(200);
      expect(list.body.tickets).toHaveLength(2);
      expect(JSON.stringify(list.body)).not.toMatch(/token/i);
      const qr = await call("GET", list.body.tickets[0].qrImageUrl.replace(/^\/api/, ""));
      expect(qr.status).toBe(200);
      expect(qr.headers["content-type"]).toBe("image/png");
      expect(qr.raw.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect((await call("GET", pub(`/bookings/${ref}/tickets/${list.body.tickets[0].id}/qr.png?k=${"b".repeat(32)}`))).status).toBe(404);
    });
  });

  describe("door check-in", () => {
    let eventTickets: Array<{ id: string; holder: string }>;
    const scan = (token: string, who = door) => call("POST", "/admit/checkin", { token: who, body: { token, eventId } });

    it("admits a ticket exactly once and tells the second scan when it was first used", async () => {
      eventTickets = await ownerQuery(`SELECT id, holder_name AS holder FROM admit_tickets WHERE event_id = $1 ORDER BY seq`, [eventId]);
      const token = ticketToken(eventTickets[0]!.id);
      const a = await scan(token);
      expect(a.status).toBe(200);
      expect(a.body).toMatchObject({ result: "ADMITTED", ticket: { id: eventTickets[0]!.id } });
      offsetMs += 60_000;
      const b = await scan(token);
      expect(b.body.result).toBe("ALREADY_USED");
      expect(new Date(b.body.firstCheckInAt).toISOString()).toBe(new Date(T0).toISOString());
      expect(b.body.gate).toBe("A");
    });

    it("admits exactly one of many simultaneous scans of the same QR", async () => {
      const token = ticketToken(eventTickets[1]!.id);
      const results = await Promise.all(Array.from({ length: 8 }, () => scan(token)));
      expect(results.filter((r) => r.body.result === "ADMITTED")).toHaveLength(1);
      expect(results.filter((r) => r.body.result === "ALREADY_USED")).toHaveLength(7);
      const row = await ownerQuery<{ n: string }>(`SELECT count(*)::text n FROM admit_scan_attempts WHERE ticket_id = $1 AND result = 'ADMITTED'`, [
        eventTickets[1]!.id,
      ]);
      expect(row[0]!.n).toBe("1");
    });

    it("answers INVALID alike for unknown, malformed and foreign tokens", async () => {
      for (const t of ["x".repeat(22), "short", ticketToken("TKT-NOPE-NOPE")]) {
        expect((await scan(t)).body).toMatchObject({ result: "INVALID", reason: "unknown" });
      }
      const typed = await call("POST", "/admit/checkin", { token: door, body: { ticketId: "TKT-ZZZZ-ZZZZ", eventId } });
      expect(typed.body).toMatchObject({ result: "INVALID", reason: "unknown" });
    });

    it("admits by typed ticket ID too, logs it as manual, and says when a ticket belongs to another event", async () => {
      const r = await book([{ ticketTypeId: generalId, quantity: 1 }], 61);
      await uploadProof(r.body.ref, keyOf(r.body.links));
      const item = await queueItem(r.body.ref);
      await approve(item!.submissionId, item!.version);
      const t = await ownerQuery<{ id: string }>(`SELECT t.id FROM admit_tickets t JOIN admit_bookings b ON b.id = t.booking_id WHERE b.ref = $1`, [
        r.body.ref,
      ]);
      expect(t[0]!.id).toMatch(/^TKT-[A-HJ-NP-Z0-9]{4}-[A-HJ-NP-Z0-9]{4}$/);

      // the owner works another event: this ticket is valid, but not here
      const venue = (await call("POST", "/admit/venues", { token: owner, body: { name: "Other Hall", capacity: 50 } })).body.id;
      const other = await call("POST", "/admit/events", {
        token: owner,
        body: { slug: "other-night", title: "Other Night", venueId: venue, startsAt: inDays(30), endsAt: inDays(30.1) },
      });
      const foreign = await call("POST", "/admit/checkin", { token: owner, body: { ticketId: t[0]!.id, eventId: other.body.id } });
      expect(foreign.body).toEqual({ result: "INVALID", reason: "other_event", at: expect.any(String) });

      const manual = await call("POST", "/admit/checkin", { token: door, body: { ticketId: t[0]!.id.toLowerCase(), eventId } });
      expect(manual.body).toMatchObject({ result: "ADMITTED", ticket: { id: t[0]!.id } });
      const log = await ownerQuery<{ method: string }>(`SELECT method FROM admit_scan_attempts WHERE ticket_id = $1 AND result = 'ADMITTED'`, [t[0]!.id]);
      expect(log[0]!.method).toBe("MANUAL");
      const again = await call("POST", "/admit/checkin", { token: door, body: { ticketId: t[0]!.id, eventId } });
      expect(again.body).toMatchObject({ result: "ALREADY_USED", firstCheckInBy: "Door" });
      expect((await call("POST", "/admit/checkin", { token: door, body: { token: "x".repeat(22), ticketId: t[0]!.id, eventId } })).status).toBe(400);
    });

    it("keeps scanning within the staff member's events", async () => {
      const other = await call("POST", "/admit/checkin", { token: door, body: { token: "x".repeat(22), eventId: "evt_other" } });
      expect(other.status).toBe(404);
      const noPerm = await call("POST", "/admit/checkin", { token: reviewer, body: { token: "x".repeat(22), eventId } });
      expect(noPerm.status).toBe(403);
    });

    it("reports attendance for the dashboard", async () => {
      const o = await call("GET", `/admit/checkin/events/${eventId}/overview`, { token: owner });
      expect(o.status).toBe(200);
      expect(o.body.totals).toMatchObject({ validTickets: 3, checkedIn: 3, remaining: 0 });
      expect(o.body.scans[0]).toMatchObject({ staff: "Door", method: "QR" });
      expect(o.body.scans.length).toBeGreaterThan(3);
      expect(o.body.arrivals.length).toBeGreaterThan(0);
      expect((await call("GET", `/admit/checkin/events/${eventId}/overview`, { token: door })).status).toBe(403);
    });

    it("treats a revoked ticket as invalid from the next scan on", async () => {
      const r = await book([{ ticketTypeId: generalId, quantity: 1 }], 60);
      const refB = r.body.ref;
      const kB = keyOf(r.body.links);
      await uploadProof(refB, kB);
      const item = await queueItem(refB);
      expect((await approve(item!.submissionId, item!.version)).status).toBe(200);
      const t = await ownerQuery<{ id: string }>(`SELECT t.id FROM admit_tickets t JOIN admit_bookings b ON b.id = t.booking_id WHERE b.ref = $1`, [refB]);
      const rev = await call("POST", `/admit/tickets/${t[0]!.id}/revoke`, { token: owner, body: { reason: "Refunded" } });
      expect(rev.body.status).toBe("REVOKED");
      expect((await scan(ticketToken(t[0]!.id))).body).toMatchObject({ result: "INVALID", reason: "revoked" });
      expect((await call("POST", `/admit/tickets/${t[0]!.id}/revoke`, { token: owner, body: { reason: "again" } })).status).toBe(409);
    });
  });

  describe("rejection and resubmission", () => {
    it("returns the booking to payment with the reason, then confirms after a better proof", async () => {
      const r = await book([{ ticketTypeId: generalId, quantity: 1 }], 70);
      const ref = r.body.ref;
      const k = keyOf(r.body.links);
      await uploadProof(ref, k);
      const item = await queueItem(ref);
      const short = await call("POST", `/admit/payments/${item!.submissionId}/reject`, {
        token: reviewer,
        body: { version: item!.version, idempotencyKey: idem(), reason: "bad" },
      });
      expect(short.status).toBe(400);
      const rej = await call("POST", `/admit/payments/${item!.submissionId}/reject`, {
        token: reviewer,
        body: { version: item!.version, idempotencyKey: idem(), reason: "The amount on the receipt is 200 EGP short." },
      });
      expect(rej.body).toMatchObject({ status: "REJECTED", bookingStatus: "AWAITING_PAYMENT" });
      const view = await call("GET", pub(`/bookings/${ref}?k=${k}`));
      expect(view.body).toMatchObject({ status: "AWAITING_PAYMENT", rejectionReason: "The amount on the receipt is 200 EGP short.", canResubmit: true });
      const mails = await ownerQuery<{ type: string; payload: Json }>(
        `SELECT type, payload FROM admit_email_messages WHERE booking_id = (SELECT id FROM admit_bookings WHERE ref = $1) AND type = 'REJECTED'`,
        [ref],
      );
      expect(mails[0]!.payload).toMatchObject({ can_resubmit: true, rejection_reason: "The amount on the receipt is 200 EGP short." });

      expect((await uploadProof(ref, k)).status).toBe(201);
      const again = await queueItem(ref);
      expect(again!.submissionId).not.toBe(item!.submissionId);
      expect((await approve(again!.submissionId, again!.version)).body.bookingStatus).toBe("CONFIRMED");
      const hist = await call("GET", `/admit/payments/${again!.submissionId}`, { token: reviewer });
      expect(hist.body.history.map((h: Json) => h.status)).toEqual(["REJECTED", "APPROVED"]);
    });
  });

  describe("hold expiry and cancellation", () => {
    it("expires an unpaid booking after the hold, releases its seats and emails the customer; IN_REVIEW is never expired", async () => {
      const unpaid = await book([{ ticketTypeId: generalId, quantity: 4 }], 80);
      const paid = await book([{ ticketTypeId: generalId, quantity: 1 }], 81);
      await uploadProof(paid.body.ref, keyOf(paid.body.links));
      const before = (await call("GET", pub("/events/jazz-night"))).body.ticketTypes[0].remaining;

      offsetMs += 25 * 3_600_000;
      const report = await get<JobsRunner>(app, JobsRunner).tick();
      expect(report!.expiredHolds).toBeGreaterThanOrEqual(1);

      const u = await call("GET", pub(`/bookings/${unpaid.body.ref}?k=${keyOf(unpaid.body.links)}`));
      expect(u.body.status).toBe("EXPIRED");
      const p = await call("GET", pub(`/bookings/${paid.body.ref}?k=${keyOf(paid.body.links)}`));
      expect(p.body.status).toBe("IN_REVIEW");
      expect((await call("GET", pub("/events/jazz-night"))).body.ticketTypes[0].remaining).toBeGreaterThanOrEqual(before + 4);
      const mails = await ownerQuery<{ n: string }>(
        `SELECT count(*)::text n FROM admit_email_messages WHERE booking_id = (SELECT id FROM admit_bookings WHERE ref = $1) AND type = 'EXPIRED'`,
        [unpaid.body.ref],
      );
      expect(mails[0]!.n).toBe("1");
      const late = await uploadProof(unpaid.body.ref, keyOf(unpaid.body.links)).catch(() => ({ status: 0 }));
      expect(late.status).not.toBe(201);
      // running the job again does nothing new
      expect((await get<JobsRunner>(app, JobsRunner).tick())!.expiredHolds).toBe(0);
    });

    it("lets the organizer cancel a confirmed booking, which revokes its tickets, but not after someone entered", async () => {
      await refreshTokens();
      const used = await ownerQuery<{ ref: string }>(
        `SELECT DISTINCT b.ref FROM admit_bookings b JOIN admit_tickets t ON t.booking_id = b.id WHERE t.status = 'USED' LIMIT 1`,
      );
      const usedBooking = await ownerQuery<{ id: string }>(`SELECT id FROM admit_bookings WHERE ref = $1`, [used[0]!.ref]);
      const blocked = await call("POST", `/admit/bookings/${usedBooking[0]!.id}/cancel`, { token: owner, body: { reason: "Customer request" } });
      expect(blocked.status).toBe(409);
      expect(blocked.body.error.code).toBe("admit.ticket_used");

      const open = await ownerQuery<{ id: string; ref: string }>(
        `SELECT b.id, b.ref FROM admit_bookings b WHERE b.status = 'CONFIRMED' AND NOT EXISTS (SELECT 1 FROM admit_tickets t WHERE t.booking_id = b.id AND t.status = 'USED') LIMIT 1`,
      );
      const c = await call("POST", `/admit/bookings/${open[0]!.id}/cancel`, { token: owner, body: { reason: "Customer request" } });
      expect(c.status).toBe(204);
      const left = await ownerQuery<{ status: string }>(`SELECT DISTINCT status FROM admit_tickets WHERE booking_id = $1`, [open[0]!.id]);
      expect(left.map((l) => l.status)).toEqual(["REVOKED"]);
    });
  });

  describe("reports and staff reach", () => {
    it("reports revenue only for confirmed bookings, with per-type sales and the payment backlog", async () => {
      await refreshTokens();
      const r = await call("GET", "/admit/reports/overview?days=30", { token: owner });
      expect(r.status).toBe(200);
      const confirmed = await ownerQuery<{ sum: string }>(`SELECT coalesce(sum(total_minor),0)::text sum FROM admit_bookings WHERE status = 'CONFIRMED'`);
      expect(r.body.revenueMinor[0]).toEqual({ currency: "EGP", amountMinor: Number(confirmed[0]!.sum) });
      expect(r.body.bookingsByStatus.CONFIRMED).toBeGreaterThanOrEqual(2);
      expect(r.body.bookingsByStatus.EXPIRED).toBeGreaterThanOrEqual(1);
      const general = r.body.byTicketType.find((t: Json) => t.name === "General");
      expect(general).toMatchObject({ capacity: 30 });
      expect(general.sold).toBeGreaterThanOrEqual(3);
      expect(r.body.paymentsWaiting.count).toBeGreaterThanOrEqual(1);
      expect((await call("GET", "/admit/reports/overview", { token: door })).status).toBe(403);
    });

    it("tells the dashboard who is signed in and how far their reach goes", async () => {
      const me = await call("GET", "/admit/me", { token: owner });
      expect(me.body).toMatchObject({ organizer: { slug: org.slug, name: "Journey Org" }, eventReach: "all" });
      expect(me.body.permissions).toContain("approve:payment");
      const d = await call("GET", "/admit/me", { token: door });
      expect(d.body.eventReach).toBe("assigned");
      expect(d.body.permissions).not.toContain("approve:payment");
      expect((await call("GET", "/admit/me")).status).toBe(401);
    });

    it("groups bookings into customers with verified spend and attendance", async () => {
      const c = await call("GET", "/admit/bookings/customers/list?search=cust", { token: owner });
      expect(c.status).toBe(200);
      expect(c.body.total).toBeGreaterThan(3);
      const withSpend = c.body.items.filter((i: Json) => i.spendMinor > 0);
      expect(withSpend.length).toBeGreaterThan(0);
      expect(c.body.items.some((i: Json) => i.attended >= 1)).toBe(true);
      expect((await call("GET", "/admit/bookings/customers/list", { token: door })).status).toBe(403);
    });

    it("lists the team with roles, and adds only existing accounts with an Admit role", async () => {
      const team = await call("GET", "/admit/team", { token: owner });
      expect(team.status).toBe(200);
      expect(team.body.members.some((m: Json) => m.roles.some((r: Json) => r.key === "owner"))).toBe(true);
      expect(team.body.roles.map((r: Json) => r.key)).toEqual(["owner", "event_manager", "finance_reviewer", "door_staff", "viewer"]);
      expect(team.body.roles[0].permissions).toContain("approve:payment");
      expect((await call("GET", "/admit/team", { token: door })).status).toBe(403);

      expect((await call("POST", "/admit/team", { token: owner, body: { email: "nobody@nowhere.test", roleKey: "viewer" } })).body.error.code).toBe(
        "admit.no_account",
      );
      expect((await call("POST", "/admit/team", { token: owner, body: { email: "x@y.test", roleKey: "root" } })).body.error.code).toBe("admit.unknown_role");
      const guest = await seedOrganizer(app, "Team Guest Org");
      expect((await call("POST", "/admit/team", { token: owner, body: { email: guest.ownerEmail, roleKey: "viewer" } })).status).toBe(204);
      const after = await call("GET", "/admit/team", { token: owner });
      const added = after.body.members.find((m: Json) => m.email === guest.ownerEmail);
      expect(added.roles.map((r: Json) => r.key)).toEqual(["viewer"]);
      expect((await call("DELETE", `/admit/team/${added.userId}/roles/viewer`, { token: owner })).status).toBe(204);
      const me = (await call("GET", "/admit/team", { token: owner })).body.members.find((m: Json) => m.roles.some((r: Json) => r.key === "owner"));
      expect((await call("DELETE", `/admit/team/${me.userId}/roles/owner`, { token: owner })).body.error.code).toBe("admit.last_owner");
      expect((await call("POST", "/admit/team", { token: door, body: { email: guest.ownerEmail, roleKey: "owner" } })).status).toBe(403);
    });

    it("assigns only organizer members to an event and lists them with their gate", async () => {
      const dr = await ownerQuery<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [doorEmail]);
      const list = await call("GET", `/admit/events/${eventId}/staff`, { token: owner });
      expect(list.body.items.some((s: Json) => s.userId === dr[0]!.id && s.gate === "A")).toBe(true);
      const moved = await call("PUT", `/admit/events/${eventId}/staff/${dr[0]!.id}`, { token: owner, body: { gate: "B" } });
      expect(moved.body.items.find((s: Json) => s.userId === dr[0]!.id).gate).toBe("B");

      const stranger = await seedOrganizer(app, "Stranger Org");
      const strangerUser = await ownerQuery<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [stranger.ownerEmail]);
      const bad = await call("PUT", `/admit/events/${eventId}/staff/${strangerUser[0]!.id}`, { token: owner, body: { gate: "" } });
      expect(bad.status).toBe(400);
      expect(bad.body.error.code).toBe("admit.not_a_member");
      expect((await call("PUT", `/admit/events/${eventId}/staff/${dr[0]!.id}`, { token: door, body: { gate: "C" } })).status).toBe(403);

      expect((await call("DELETE", `/admit/events/${eventId}/staff/${dr[0]!.id}`, { token: owner })).status).toBe(204);
      expect((await call("GET", "/admit/checkin/events", { token: door })).body.events).toEqual([]);
    });
  });

  describe("email visibility and tenant isolation", () => {
    it("lists delivery status and only lets FAILED messages be retried", async () => {
      await refreshTokens();
      const list = await call("GET", "/admit/emails?status=QUEUED", { token: reviewer });
      expect(list.status).toBe(200);
      expect(list.body.items.length).toBeGreaterThan(3);
      const id = list.body.items[0].id;
      expect((await call("POST", `/admit/emails/${id}/retry`, { token: reviewer })).status).toBe(409);
      await ownerQuery(`UPDATE admit_email_messages SET status = 'FAILED', attempts = 3, last_error = 'SMTP 550' WHERE id = $1`, [id]);
      expect((await call("POST", `/admit/emails/${id}/retry`, { token: reviewer })).status).toBe(204);
      const after = await ownerQuery<{ status: string; attempts: number }>(`SELECT status, attempts FROM admit_email_messages WHERE id = $1`, [id]);
      expect(after[0]).toEqual({ status: "QUEUED", attempts: 0 });
      expect((await call("GET", "/admit/emails", { token: door })).status).toBe(403);
    });

    it("keeps another organizer out of everything", async () => {
      const other = await seedOrganizer(app, "Rival Org");
      const t = await loginAs(http, other.ownerEmail);
      expect((await call("GET", "/admit/payments", { token: t })).body.items ?? []).toEqual([]);
      expect((await call("GET", "/admit/bookings", { token: t })).body.items).toEqual([]);
      expect((await call("GET", "/admit/emails", { token: t })).body.items).toEqual([]);
      const item = (await ownerQuery<{ id: string }>(`SELECT id FROM admit_payment_submissions LIMIT 1`))[0]!;
      expect((await call("GET", `/admit/payments/${item.id}`, { token: t })).status).toBe(404);
      expect((await call("POST", "/admit/checkin", { token: t, body: { token: "x".repeat(22), eventId } })).status).toBe(404);
      // and their public site does not show our events
      expect((await call("GET", `/admit/public/${other.slug}/events`)).body.events).toEqual([]);
      expect((await call("GET", `/admit/public/${other.slug}/events/jazz-night`)).status).toBe(404);
    });
  });
});
