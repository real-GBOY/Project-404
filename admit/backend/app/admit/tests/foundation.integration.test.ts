/**
 * Slice 0/1 - the foundation: a clean migrate-from-zero, RLS on every tenant-scoped Admit table, idempotent
 * seeding, and the event catalogue behind the real HTTP stack (guards, Zod pipes, per-event staff reach).
 */
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";
import type { TestingModule } from "@nestjs/testing";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@core/kernel/clock.js";
import { TEST_DATABASE_URL } from "@core/tests/helpers.js";
import { AppSeedService } from "@admit/seed.js";
import { admitDb } from "@admit/admit/db/executor.js";
import { asUser, createAdmitHttpTestApp, get, hasTestDb, loginAs, seedOrganizer, seedStaff, type SeededOrganizer } from "./helpers.js";

const MIGRATIONS_DIR = fileURLToPath(new URL("../../../prisma/migrations", import.meta.url));

async function ownerQuery<T extends pg.QueryResultRow>(text: string, params: unknown[] = []) {
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    return (await client.query<T>(text, params)).rows;
  } finally {
    await client.end();
  }
}

const NOW = "2026-10-20T08:00:00.000Z";
const inDays = (n: number) => new Date(Date.parse(NOW) + n * 86_400_000).toISOString();

describe.skipIf(!hasTestDb)("Admit foundation and event catalogue", () => {
  let app: TestingModule;
  let http: NestFastifyApplication;
  let org: SeededOrganizer;
  let token: string;
  const clock = fixedClock(NOW);

  const api = async (method: "GET" | "POST" | "PATCH" | "DELETE", url: string, payload?: unknown, bearer = token) => {
    const res = await http.inject({ method, url: `/api${url}`, payload: payload as never, headers: { authorization: `Bearer ${bearer}` } });
    return { status: res.statusCode, body: res.body ? (res.json() as Record<string, any>) : {} };
  };

  beforeAll(async () => {
    const booted = await createAdmitHttpTestApp({ clock });
    app = booted.moduleRef;
    http = booted.http;
    org = await seedOrganizer(app, "Foundation Org");
    token = await loginAs(http, org.ownerEmail);
  }, 120_000);

  afterAll(async () => {
    await http?.close();
  });

  describe("database bootstrap", () => {
    it("applies every migration from an empty schema, none failed or rolled back", async () => {
      const dirs = (await readdir(MIGRATIONS_DIR, { withFileTypes: true }))
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort();
      const applied = await ownerQuery<{ migration_name: string }>(
        `SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`,
      );
      expect(applied.map((r) => r.migration_name)).toEqual(dirs);
    });

    it("forces row-level security with a tenant_isolation policy on every tenant-scoped table", async () => {
      const tables = await ownerQuery<{ table: string; rls: boolean; forced: boolean; policies: string[] | null }>(
        `SELECT c.relname AS table, c.relrowsecurity AS rls, c.relforcerowsecurity AS forced,
                (SELECT array_agg(p.polname::text) FROM pg_policy p WHERE p.polrelid = c.oid) AS policies
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
          WHERE c.relkind = 'r'
            AND EXISTS (SELECT 1 FROM information_schema.columns col
                         WHERE col.table_schema = 'public' AND col.table_name = c.relname AND col.column_name = 'organization_id')
          ORDER BY c.relname`,
      );
      expect(tables.filter((t) => t.table.startsWith("admit_")).length).toBeGreaterThanOrEqual(12);
      const unprotected = tables.filter((t) => !t.rls || !t.forced || !t.policies?.length);
      expect(unprotected.map((t) => t.table)).toEqual([]);
    });
  });

  describe("seeding", () => {
    it("registers the Admit permissions and roles, and is idempotent on re-run", async () => {
      await get<AppSeedService>(app, AppSeedService).seed();
      const roles = await ownerQuery<{ key: string }>(
        `SELECT key FROM roles WHERE key IN ('owner','event_manager','finance_reviewer','door_staff','viewer') ORDER BY key`,
      );
      expect(roles.map((r) => r.key)).toEqual(["door_staff", "event_manager", "finance_reviewer", "owner", "viewer"]);
      const perms = await ownerQuery<{ n: string }>(
        `SELECT count(*)::text AS n FROM permissions WHERE resource IN ('event','ticket_type','payment','checkin')`,
      );
      expect(Number(perms[0]!.n)).toBeGreaterThanOrEqual(8);
    });
  });

  describe("event catalogue", () => {
    let venueId: string;
    let eventId: string;
    const eventBody = (slug: string) => ({
      slug,
      title: "Cairo Jazz Night",
      category: "Music",
      venueId,
      startsAt: inDays(20),
      endsAt: inDays(20.2),
      policies: { refund: "No refunds." },
    });

    it("creates a venue and a draft event; validates the window", async () => {
      const v = await api("POST", "/admit/venues", { name: "Opera Hall", area: "Zamalek", capacity: 100 });
      expect(v.status).toBe(201);
      venueId = v.body.id;
      const bad = await api("POST", "/admit/events", { ...eventBody("bad-window"), endsAt: inDays(19) });
      expect(bad.status).toBe(400);
      const ok = await api("POST", "/admit/events", eventBody("cairo-jazz-night"));
      expect(ok.status).toBe(201);
      expect(ok.body.status).toBe("draft");
      eventId = ok.body.id;
      const dup = await api("POST", "/admit/events", eventBody("cairo-jazz-night"));
      expect(dup.status).toBe(409);
      expect(dup.body.error.code).toBe("admit.slug_taken");
    });

    it("refuses to publish an event nobody could buy, then publishes once it is complete", async () => {
      expect((await api("POST", `/admit/events/${eventId}/publish`)).body.error.code).toBe("admit.no_ticket_types");
      const t = await api("POST", `/admit/events/${eventId}/ticket-types`, { name: "General", priceMinor: 25000, quantity: 60 });
      expect(t.status).toBe(201);
      expect((await api("POST", `/admit/events/${eventId}/publish`)).body.error.code).toBe("admit.no_payment_method");
      const m = await api("POST", `/admit/events/${eventId}/payment-methods`, {
        type: "instapay",
        label: "InstaPay",
        recipientName: "Admit Org",
        identifier: "admit@instapay",
      });
      expect(m.status).toBe(201);
      const pub = await api("POST", `/admit/events/${eventId}/publish`);
      expect(pub.status).toBe(200);
      expect(pub.body.status).toBe("published");
      expect(pub.body.ticketTypes[0]).toMatchObject({ quantity: 60, held: 0, remaining: 60 });
    });

    it("rejects ticket quantities that exceed the venue capacity", async () => {
      const over = await api("POST", `/admit/events/${eventId}/ticket-types`, { name: "VIP", priceMinor: 90000, quantity: 50 });
      expect(over.status).toBe(400);
      expect(over.body.error.code).toBe("admit.venue_capacity");
    });

    it("locks the address of a published event", async () => {
      const r = await api("PATCH", `/admit/events/${eventId}`, { slug: "other-address" });
      expect(r.status).toBe(409);
      expect(r.body.error.code).toBe("admit.slug_locked");
    });

    it("hides events from staff who are not assigned, and from other organizers", async () => {
      const door = await seedStaff(app, org, "door_staff", "Door Person");
      const doorToken = await loginAs(http, door.email);
      expect((await api("GET", "/admit/events", undefined, doorToken)).body.items).toEqual([]);
      expect((await api("GET", `/admit/events/${eventId}`, undefined, doorToken)).status).toBe(404);
      expect((await api("POST", "/admit/events", eventBody("nope"), doorToken)).status).toBe(403);

      await asUser(org.ownerId, org.orgId, () =>
        admitDb().insertInto("admit_event_staff").values({ organization_id: org.orgId, event_id: eventId, user_id: door.userId, gate: "A" }).execute(),
      );
      expect((await api("GET", "/admit/events", undefined, doorToken)).body.items).toHaveLength(1);

      const other = await seedOrganizer(app, "Other Org");
      const otherToken = await loginAs(http, other.ownerEmail);
      expect((await api("GET", "/admit/events", undefined, otherToken)).body.items).toEqual([]);
      expect((await api("GET", `/admit/events/${eventId}`, undefined, otherToken)).status).toBe(404);
    });
  });
});
