/**
 * The opt-in demo organizer: seeded exactly once through the real services, with the states the dashboard screens need
 * (a review queue, a rejected booking, an expired hold, a failed email, a live event with door scans).
 */
import pg from "pg";
import type { TestingModule } from "@nestjs/testing";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { systemClock } from "@core/kernel/clock.js";
import { TEST_DATABASE_URL } from "@core/tests/helpers.js";
import { DemoSeeder } from "@admit/admit/demo/demo-seeder.js";
import { DEMO_ORG, DEMO_PASSWORD, DEMO_STAFF } from "@admit/admit/demo/demo-data.js";
import { createAdmitHttpTestApp, get, hasTestDb, loginAs } from "./helpers.js";

async function ownerQuery<T extends pg.QueryResultRow>(text: string, params: unknown[] = []) {
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    return (await client.query<T>(text, params)).rows;
  } finally {
    await client.end();
  }
}

describe.skipIf(!hasTestDb)("Admit demo organizer", () => {
  let app: TestingModule;
  let http: NestFastifyApplication;
  const api = async (url: string, token: string) => {
    const res = await http.inject({ method: "GET", url: `/api${url}`, headers: { authorization: `Bearer ${token}` } });
    return { status: res.statusCode, body: res.json() as Record<string, any> };
  };

  beforeAll(async () => {
    const booted = await createAdmitHttpTestApp();
    app = booted.moduleRef;
    http = booted.http;
    const seeder = get<DemoSeeder>(app, DemoSeeder);
    await seeder.seed(systemClock);
    await seeder.seed(systemClock); // idempotent
  }, 180_000);

  afterAll(async () => {
    await http?.close();
  });

  it("creates the organizer once, with staff who can sign in", async () => {
    const orgs = await ownerQuery(`SELECT 1 FROM organizations WHERE slug = $1`, [DEMO_ORG.slug]);
    expect(orgs).toHaveLength(1);
    for (const s of DEMO_STAFF) expect(await loginAs(http, s.email, DEMO_PASSWORD)).toBeTruthy();
  });

  it("covers every booking state the screens draw", async () => {
    const rows = await ownerQuery<{ status: string; n: string }>(`SELECT status, count(*)::text n FROM admit_bookings GROUP BY status`);
    const by = Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
    expect(by.CONFIRMED).toBeGreaterThanOrEqual(8);
    expect(by.IN_REVIEW).toBeGreaterThanOrEqual(5);
    expect(by.AWAITING_PAYMENT).toBeGreaterThanOrEqual(3);
    expect(by.EXPIRED).toBeGreaterThanOrEqual(1);
    expect(by.CANCELLED).toBeGreaterThanOrEqual(1);
    const mail = await ownerQuery<{ status: string }>(`SELECT DISTINCT status FROM admit_email_messages`);
    expect(mail.map((m) => m.status).sort()).toEqual(expect.arrayContaining(["ACCEPTED", "FAILED", "QUEUED", "RETRYING"]));
  });

  it("gives the reviewer a queue, the owner every event, and the door person the live one", async () => {
    const karim = await loginAs(http, "karim@nilesessions.example", DEMO_PASSWORD);
    const queue = await api("/admit/payments", karim);
    expect(queue.body.items.length).toBe(6);
    expect(queue.body.items.some((q: any) => q.flags.length === 0)).toBe(true);

    const salma = await loginAs(http, "salma@nilesessions.example", DEMO_PASSWORD);
    const events = await api("/admit/events", salma);
    expect(events.body.items.map((e: any) => e.status).sort()).toEqual([
      "draft",
      "draft",
      "published",
      "published",
      "published",
      "published",
      "published",
      "published",
    ]);

    const ali = await loginAs(http, "ali@nilesessions.example", DEMO_PASSWORD);
    const mine = await api("/admit/checkin/events", ali);
    const live = mine.body.events.find((e: any) => e.title.startsWith("Gallery Night"));
    expect(live).toMatchObject({ gate: "Gate A", checkedIn: 3 });
    expect(live.remaining).toBe(4); // 7 tickets issued, 3 already through the door
  });

  it("serves the public catalogue of the demo organizer", async () => {
    const res = await http.inject({ method: "GET", url: `/api/admit/public/${DEMO_ORG.slug}/events` });
    const body = res.json() as Record<string, any>;
    expect(body.events.length).toBe(6);
    expect(body.organizer.name).toBe(DEMO_ORG.name);
    expect(body.categories.length).toBeGreaterThan(3);
  });
});
