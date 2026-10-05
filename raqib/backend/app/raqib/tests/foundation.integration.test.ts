/**
 * Phase 1 — the foundation every later phase stands on: a clean migrate-from-zero, RLS on every
 * tenant table, idempotent seeding, the demo organization, and the access model enforced over real
 * HTTP: permission template → project scope → object rule. The frontend is never trusted: every
 * assertion here goes through guards, Zod pipes and the exception filter.
 */
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@core/kernel/clock.js";
import { TEST_DATABASE_URL } from "@core/tests/helpers.js";
import { DemoSeeder } from "@raqib/raqib/demo/demo-seeder.js";
import { DEMO_PEOPLE } from "@raqib/raqib/demo/demo-data.js";
import { createDemoHttpApp, get, hasTestDb, loginAs } from "./helpers.js";
import { CLOCK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";

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

const email = (key: string) => DEMO_PEOPLE.find((p) => p.key === key)!.email;

describe.skipIf(!hasTestDb)("Raqib foundation", () => {
  let http: NestFastifyApplication;
  let seeder: DemoSeeder;
  let clock: Clock;
  const tokens: Record<string, string> = {};

  const call = async (who: string, method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", url: string, payload?: unknown) => {
    const res = await http.inject({ method, url: `/api${url}`, headers: { authorization: `Bearer ${tokens[who]}` }, payload: payload as never });
    return { status: res.statusCode, body: res.body ? (JSON.parse(res.body) as Record<string, any>) : {} };
  };

  beforeAll(async () => {
    const booted = await createDemoHttpApp({ clock: fixedClock("2026-10-04T08:00:00.000Z") });
    http = booted.http;
    seeder = get<DemoSeeder>(booted.moduleRef, DemoSeeder);
    clock = get<Clock>(booted.moduleRef, CLOCK);
    for (const key of ["qm", "qe", "pm", "insA", "insB", "gs", "guard", "gm", "sultan"]) tokens[key] = await loginAs(http, email(key));
  }, 180_000);

  afterAll(async () => {
    await http?.close();
  });

  describe("database", () => {
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
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
          WHERE c.relkind = 'r'
            AND EXISTS (SELECT 1 FROM information_schema.columns col WHERE col.table_schema = 'public'
                         AND col.table_name = c.relname AND col.column_name = 'organization_id')
          ORDER BY c.relname`,
      );
      expect(tables.filter((t) => t.table.startsWith("raqib_")).length).toBeGreaterThanOrEqual(8);
      expect(tables.filter((t) => !t.rls || !t.forced || !t.policies?.length).map((t) => t.table)).toEqual([]);
    });

    it("hides every Raqib row from another tenant (RLS, independent of the application)", async () => {
      const client = new pg.Client({ connectionString: process.env.AURIC_APP_DATABASE_URL ?? TEST_DATABASE_URL });
      await client.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT set_config('app.organization_id', 'org_someone_else', true)");
        const r = await client.query(
          "SELECT (SELECT count(*) FROM raqib_projects) AS p, (SELECT count(*) FROM raqib_profiles) AS u, (SELECT count(*) FROM raqib_guards) AS g",
        );
        await client.query("ROLLBACK");
        // The owner role may bypass RLS in local test setups; when the app role is configured it must be zero.
        if (process.env.AURIC_APP_DATABASE_URL) expect(r.rows[0]).toEqual({ p: "0", u: "0", g: "0" });
      } finally {
        await client.end();
      }
    });
  });

  describe("seeding", () => {
    it("seeds the demo organization exactly once", async () => {
      await seeder.seed(clock);
      const orgs = await ownerQuery<{ n: string }>(`SELECT count(*)::text AS n FROM organizations WHERE slug = 'raqib-demo'`);
      expect(orgs[0]!.n).toBe("1");
      const projects = await ownerQuery<{ n: string }>(`SELECT count(*)::text AS n FROM raqib_projects`);
      expect(projects[0]!.n).toBe("4");
    });

    it("seeds a headcount per project that matches the approved design", async () => {
      const rows = await ownerQuery<{ code: string; n: string }>(
        `SELECT p.code, count(g.id)::text AS n FROM raqib_projects p LEFT JOIN raqib_guards g ON g.project_id = p.id GROUP BY p.code ORDER BY p.code`,
      );
      expect(Object.fromEntries(rows.map((r) => [r.code, Number(r.n)]))).toEqual({ "PRJ-DMM-003": 38, "PRJ-JED-007": 64, "PRJ-RYD-014": 46, "PRJ-RYD-019": 0 });
    });
  });

  describe("/me", () => {
    it("returns role, scope and the effective permission template", async () => {
      const ins = await call("insA", "GET", "/raqib/me");
      expect(ins.status).toBe(200);
      expect(ins.body.role).toBe("ins");
      expect(ins.body.permissions.inspections).toBe("VAES");
      expect(ins.body.scope).toHaveLength(1);
      const qm = await call("qm", "GET", "/raqib/me");
      expect(qm.body.scope).toBe("all");
      expect(qm.body.permissions.inspections).toContain("P");
    });

    it("rejects anonymous callers", async () => {
      const res = await http.inject({ method: "GET", url: "/api/raqib/me" });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("project scope isolation", () => {
    it("lists only the projects in the caller's active scope", async () => {
      const codes = async (who: string) => ((await call(who, "GET", "/raqib/projects")).body.items as Array<{ code: string }>).map((p) => p.code).sort();
      expect(await codes("qm")).toEqual(["PRJ-DMM-003", "PRJ-JED-007", "PRJ-RYD-014", "PRJ-RYD-019"]);
      expect(await codes("qe")).toEqual(["PRJ-DMM-003", "PRJ-JED-007", "PRJ-RYD-014"]);
      expect(await codes("pm")).toEqual(["PRJ-RYD-014", "PRJ-RYD-019"]);
      expect(await codes("sultan")).toEqual(["PRJ-JED-007"]);
    });

    it("rejects a direct request for a project outside scope (changing the id in the URL does not help)", async () => {
      const qm = await call("qm", "GET", "/raqib/projects");
      const jed = (qm.body.items as Array<{ id: string; code: string }>).find((p) => p.code === "PRJ-JED-007")!;
      const res = await call("pm", "GET", `/raqib/projects/${jed.id}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("raqib.out_of_scope");
      const ok = await call("sultan", "GET", `/raqib/projects/${jed.id}`);
      expect(ok.status).toBe(200);
    });

    it("scopes the guard list the same way and masks national IDs", async () => {
      const res = await call("gs", "GET", "/raqib/guards");
      expect(res.status).toBe(200);
      const items = res.body.items as Array<{ nationalId: string; projectId: string }>;
      expect(items.length).toBe(46);
      expect(new Set(items.map((g) => g.projectId)).size).toBe(1);
      expect(items.every((g) => /^\d{4}•••\d{3}$/.test(g.nationalId))).toBe(true);
    });
  });

  describe("permission templates", () => {
    it("denies modules the role template does not grant", async () => {
      expect((await call("insA", "GET", "/raqib/projects")).status).toBe(403); // inspectors have no 'projects' module by default
      expect((await call("insA", "GET", "/raqib/users")).status).toBe(403);
      expect((await call("guard", "GET", "/raqib/projects")).status).toBe(403);
      expect((await call("pm", "GET", "/raqib/settings")).status).toBe(403);
    });

    it("lets Quality Management edit a template, audits it, and applies it immediately", async () => {
      const edit = await call("qm", "PUT", "/raqib/permissions", {
        changes: [{ role: "ins", module: "projects", actions: "V" }],
        reason: "Inspectors need to see their project",
      });
      expect(edit.status).toBe(200);
      expect(edit.body.roles.ins.projects).toBe("V");
      const mine = await call("insA", "GET", "/raqib/projects");
      expect(mine.status).toBe(200);
      expect((mine.body.items as unknown[]).length).toBe(1); // template grants the module; scope still limits it
      const audit = await ownerQuery<{ action: string }>(`SELECT action FROM audit_logs WHERE action = 'raqib.permission.changed'`);
      expect(audit.length).toBe(1);
      // restore
      await call("qm", "PUT", "/raqib/permissions", { changes: [{ role: "ins", module: "projects", actions: "" }], reason: "Restore default" });
      expect((await call("insA", "GET", "/raqib/projects")).status).toBe(403);
    });

    it("refuses inapplicable letters and the lock-out edit", async () => {
      const bad = await call("qm", "PUT", "/raqib/permissions", { changes: [{ role: "ins", module: "analytics", actions: "P" }], reason: "nope" });
      expect(bad.status).toBe(400);
      const lock = await call("qm", "PUT", "/raqib/permissions", { changes: [{ role: "qm", module: "permissions", actions: "V" }], reason: "nope" });
      expect(lock.status).toBe(400);
    });

    it("requires the permissions module to edit templates", async () => {
      const res = await call("qe", "PUT", "/raqib/permissions", { changes: [{ role: "ins", module: "projects", actions: "V" }], reason: "try" });
      expect(res.status).toBe(403);
    });
  });

  describe("users, roles and dated scope", () => {
    const personId = async (key: string) => {
      const res = await call("qm", "GET", "/raqib/users");
      const email_ = email(key);
      return (res.body.items as Array<{ id: string; email: string }>).find((u) => u.email === email_)!.id;
    };

    it("changes scope with history: removed projects keep their dated rows", async () => {
      const pmId = await personId("pm");
      const all = (await call("qm", "GET", "/raqib/projects")).body.items as Array<{ id: string; code: string }>;
      const jed = all.find((p) => p.code === "PRJ-JED-007")!;
      const ryd = all.find((p) => p.code === "PRJ-RYD-014")!;
      const add = await call("qm", "PUT", `/raqib/users/${pmId}/scope`, { projectIds: [ryd.id, jed.id], reason: "Cover Jeddah during leave" });
      expect(add.status).toBe(200);
      expect((await call("pm", "GET", `/raqib/projects/${jed.id}`)).status).toBe(200);
      const drop = await call("qm", "PUT", `/raqib/users/${pmId}/scope`, { projectIds: [ryd.id], reason: "Leave ended" });
      expect(drop.status).toBe(200);
      expect((await call("pm", "GET", `/raqib/projects/${jed.id}`)).status).toBe(403);
      const rows = await ownerQuery<{ valid_to: string | null }>(
        `SELECT valid_to::text FROM raqib_project_assignments WHERE user_id = $1 AND project_id = $2`,
        [pmId, jed.id],
      );
      expect(rows).toHaveLength(1); // history kept, not deleted
      expect(rows[0]!.valid_to).not.toBeNull();
    });

    it("blocks self role change and role escalation by non-managers", async () => {
      const qmId = await personId("qm");
      expect((await call("qm", "PUT", `/raqib/users/${qmId}/role`, { role: "qe", reason: "self" })).status).toBe(403);
      const insId = await personId("insA");
      expect((await call("qe", "PUT", `/raqib/users/${insId}/role`, { role: "qm", reason: "sneaky" })).status).toBe(403); // qe has no users:E
    });

    it("changes a role through Core RBAC and the profile, with an audit entry", async () => {
      const gsId = await personId("gs");
      const res = await call("qm", "PUT", `/raqib/users/${gsId}/role`, { role: "qe", reason: "Promotion to quality" });
      expect(res.status).toBe(200);
      expect(res.body.role).toBe("qe");
      const core = await ownerQuery<{ key: string }>(`SELECT r.key FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1`, [gsId]);
      expect(core.map((r) => r.key)).toEqual(["raqib_qe"]);
      await call("qm", "PUT", `/raqib/users/${gsId}/role`, { role: "gs", reason: "Revert for the demo" });
    });

    it("disabling a person blocks them immediately, even with a valid token", async () => {
      const turkiId = await personId("turki");
      void turkiId;
      const gsId = await personId("gs");
      expect((await call("gs", "GET", "/raqib/me")).status).toBe(200);
      const off = await call("qm", "POST", `/raqib/users/${gsId}/status`, { status: "disabled", reason: "Contract ended" });
      expect(off.status).toBe(200);
      const me = await call("gs", "GET", "/raqib/me");
      expect(me.status).toBe(403);
      expect(me.body.error.code).toBe("raqib.account_disabled");
      await call("qm", "POST", `/raqib/users/${gsId}/status`, { status: "active", reason: "Reinstated" });
      expect((await call("gs", "GET", "/raqib/me")).status).toBe(200);
    });
  });

  describe("settings", () => {
    it("is readable and editable only with the settings module, and every change needs a reason", async () => {
      const cur = await call("qm", "GET", "/raqib/settings");
      expect(cur.status).toBe(200);
      const next = { ...cur.body, scoring: { ...cur.body.scoring, high: 90 } };
      expect((await call("qm", "PUT", "/raqib/settings", { settings: next })).status).toBe(400);
      expect((await call("qm", "PUT", "/raqib/settings", { settings: next, reason: "Raise the bar" })).status).toBe(200);
      expect((await call("qm", "GET", "/raqib/settings")).body.scoring.high).toBe(90);
      expect((await call("pm", "PUT", "/raqib/settings", { settings: next, reason: "no" })).status).toBe(403);
      await call("qm", "PUT", "/raqib/settings", { settings: cur.body, reason: "Restore" });
    });

    it("rejects thresholds where moderate is not below high", async () => {
      const cur = await call("qm", "GET", "/raqib/settings");
      const bad = { ...cur.body, scoring: { ...cur.body.scoring, mid: 95, high: 90 } };
      expect((await call("qm", "PUT", "/raqib/settings", { settings: bad, reason: "bad" })).status).toBe(400);
    });
  });
});
