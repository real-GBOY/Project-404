/**
 * Slice 0 — the foundation every later slice stands on: a clean migrate-from-zero, the Core
 * baseline + HotelOS extensions in place, RLS on every tenant-scoped table, idempotent seeding,
 * the demo hotel, and the HTTP stack (health, auth, /me) wired exactly as production wires it.
 */
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";
import type { TestingModule } from "@nestjs/testing";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@core/kernel/clock.js";
import { TEST_DATABASE_URL } from "@core/tests/helpers.js";
import { AppSeedService } from "@hotel/seed.js";
import { hotelDb } from "@hotel/hotel/db/executor.js";
import { DemoSeeder } from "@hotel/hotel/demo/demo-seeder.js";
import { DEMO_ORG, DEMO_PASSWORD, DEMO_STAFF } from "@hotel/hotel/demo/demo-data.js";
import {
  asSystem,
  asUser,
  createHotelHttpTestApp,
  get,
  hasTestDb,
  loginAs,
  seedHotel,
} from "./helpers.js";

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

describe.skipIf(!hasTestDb)("HotelOS foundation", () => {
  let app: TestingModule;
  let http: NestFastifyApplication;
  const clock = fixedClock("2026-09-27T08:00:00.000Z");

  beforeAll(async () => {
    const booted = await createHotelHttpTestApp({ clock });
    app = booted.moduleRef;
    http = booted.http;
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
        `SELECT migration_name FROM _prisma_migrations
          WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
          ORDER BY migration_name`,
      );
      expect(applied.map((r) => r.migration_name)).toEqual(dirs);
    });

    it("installs btree_gist — the no-double-booking exclusion constraint depends on it", async () => {
      const rows = await ownerQuery(`SELECT 1 FROM pg_extension WHERE extname = 'btree_gist'`);
      expect(rows).toHaveLength(1);
    });

    it("forces row-level security with a tenant_isolation policy on every tenant-scoped table", async () => {
      const tables = await ownerQuery<{
        table: string;
        rls: boolean;
        forced: boolean;
        policies: string[] | null;
      }>(
        `SELECT c.relname AS table, c.relrowsecurity AS rls, c.relforcerowsecurity AS forced,
                (SELECT array_agg(p.polname::text) FROM pg_policy p WHERE p.polrelid = c.oid) AS policies
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
          WHERE c.relkind = 'r'
            AND EXISTS (SELECT 1 FROM information_schema.columns col
                         WHERE col.table_schema = 'public' AND col.table_name = c.relname
                           AND col.column_name = 'organization_id')
          ORDER BY c.relname`,
      );
      expect(tables.length).toBeGreaterThan(0);
      const unprotected = tables.filter((t) => !t.rls || !t.forced || !t.policies?.length);
      expect(unprotected.map((t) => t.table)).toEqual([]);
    });
  });

  describe("seeding", () => {
    it("seeds Core RBAC (the admin wildcard role) and is idempotent on re-run", async () => {
      await get<AppSeedService>(app, AppSeedService).seed();
      const admin = await ownerQuery<{ n: string }>(
        `SELECT count(*)::text AS n FROM roles WHERE key = 'admin'`,
      );
      expect(admin[0]!.n).toBe("1");
    });

    it("seeds the Hotel Nayel demo property exactly once", async () => {
      const seeder = get<DemoSeeder>(app, DemoSeeder);
      await seeder.seed(clock);
      await seeder.seed(clock);
      const orgs = await ownerQuery<{ name: string }>(
        `SELECT name FROM organizations WHERE slug = $1`,
        [DEMO_ORG.slug],
      );
      expect(orgs).toEqual([{ name: "Hotel Nayel" }]);
    });
  });

  describe("tenant isolation through hotelDb()", () => {
    it("sees only the caller's own organization's rows inside a tenant transaction", async () => {
      const a = await seedHotel(app, "Hotel A");
      const b = await seedHotel(app, "Hotel B");
      const visible = await asUser(a.ownerId, a.orgId, () =>
        hotelDb().selectFrom("organization_members").select("organization_id").execute(),
      );
      expect(visible.length).toBeGreaterThan(0);
      expect(new Set(visible.map((r) => r.organization_id))).toEqual(new Set([a.orgId]));

      const all = await asSystem(() =>
        hotelDb()
          .selectFrom("organization_members")
          .select("organization_id")
          .where("organization_id", "in", [a.orgId, b.orgId])
          .execute(),
      );
      expect(new Set(all.map((r) => r.organization_id))).toEqual(new Set([a.orgId, b.orgId]));
    });
  });

  describe("HTTP stack", () => {
    it("serves liveness under the /api prefix", async () => {
      const res = await http.inject({ method: "GET", url: "/api/health" });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ status: "ok" });
    });

    it("rejects an unauthenticated /api/me with the structured error envelope", async () => {
      const res = await http.inject({ method: "GET", url: "/api/me" });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toHaveProperty("error.code");
    });

    it("signs the demo owner in and resolves their hotel + permissions from /api/me", async () => {
      await get<DemoSeeder>(app, DemoSeeder).seed(clock);
      const token = await loginAs(http, DEMO_STAFF[0]!.email, DEMO_PASSWORD);
      const res = await http.inject({
        method: "GET",
        url: "/api/me",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const me = res.json() as {
        user: { displayName: string };
        organizationId: string;
        permissions: string[];
      };
      expect(me.user.displayName).toBe("Ahmed Nabil");
      expect(me.organizationId).toMatch(/^org_/);
      expect(me.permissions).toContain("*:*");
    });

    it("does not leak internals on a wrong password", async () => {
      const res = await http.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: DEMO_STAFF[0]!.email, password: "wrong-password" },
      });
      expect(res.statusCode).toBe(401);
      expect(res.body).not.toMatch(/stack|argon|sql|select /i);
    });
  });
});
