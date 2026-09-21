import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadManifests } from "../src/manifest.js";
import { resolveSelection } from "../src/resolve.js";
import {
  APP_PASSWORD,
  canConnect,
  createDatabase,
  dropDatabase,
  migrateDeploy,
  provisionRoles,
  repoRoot,
  scaffold,
  snapshot,
  tableNames,
  urlFor,
  type ScaffoldedProject,
} from "./support.js";

/**
 * The combinations the scaffolder must support. Several requests resolve to the
 * same install set (Identity pulls in Organizations + RBAC — they reference each
 * other), so the distinct sets are what actually get built; the request labels
 * are kept so a failure reads as the developer's choice, not an internal key.
 */
const REQUESTS: Record<string, string[]> = {
  "base only": [],
  "base + identity": ["identity"],
  "base + identity + organizations": ["identity", "organizations"],
  "base + identity + organizations + rbac": ["identity", "organizations", "rbac"],
  "base + files": ["files"],
  "base + notifications": ["notifications"],
  "base + messaging": ["messaging"],
  "base + assistant": ["assistant"],
  "full core": ["files", "notifications", "messaging", "assistant"],
};

const manifests = loadManifests(join(repoRoot, "core"));
const byName = new Map(manifests.map((m) => [m.name, m]));

const distinct = new Map<string, { selected: string[]; labels: string[]; modules: string[] }>();
for (const [label, modules] of Object.entries(REQUESTS)) {
  const { selected } = resolveSelection(manifests, modules);
  const key = selected.join("+");
  const entry = distinct.get(key) ?? { selected, labels: [], modules };
  entry.labels.push(label);
  distinct.set(key, entry);
}

const available = await canConnect();

/** A minimal row for each RLS-protected table that has no foreign keys, keyed by table. */
const INSERTS: Record<string, (id: string, org: string) => string> = {
  audit_logs: (id, org) =>
    `INSERT INTO audit_logs (id, action, resource_type, organization_id) VALUES ('${id}', 'probe', 'probe', '${org}')`,
  files: (id, org) =>
    `INSERT INTO files (id, storage_key, driver, original_name, content_type, byte_size, checksum_sha256, organization_id)
     VALUES ('${id}', 'k-${id}', 'local', 'a.txt', 'text/plain', 1, 'x', '${org}')`,
  ai_conversations: (id, org) =>
    `INSERT INTO ai_conversations (id, organization_id, user_id) VALUES ('${id}', '${org}', 'u1')`,
  messaging_conversations: (id, org) =>
    `INSERT INTO messaging_conversations (id, organization_id, type, created_by) VALUES ('${id}', '${org}', 'group', 'u1')`,
};

async function withClient<T>(url: string, fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

describe.skipIf(!available).each([...distinct.entries()])("scaffold %s", (key, combo) => {
  const dbName = `auric_scaffold_${key.replace(/[^a-z]+/g, "_").slice(0, 40)}_${distinct.size}`.slice(0, 60);
  const expectedManifests = combo.selected.map((n) => byName.get(n)!);
  const expectedTables = expectedManifests.flatMap((m) => m.tables).sort();
  let project: ScaffoldedProject;
  let owner: string;

  beforeAll(async () => {
    project = await scaffold("matrix", combo.modules);
    owner = await createDatabase(dbName);
    await migrateDeploy(project.outDir, owner);
    await provisionRoles(owner);
  }, 240_000);

  afterAll(async () => {
    await project?.cleanup();
    await dropDatabase(dbName);
  });

  it(`installs ${combo.selected.join(", ")} (requested: ${combo.labels.join(" | ")})`, () => {
    expect(project.resolution.selected).toEqual(combo.selected);
  });

  it("generates exactly two migrations and a lock file, and names no product", () => {
    expect(project.migrations.map((m) => m.name.replace(/^\d+_/, ""))).toEqual(["auric_baseline", "auric_security"]);
    expect(project.files).toContain("prisma/migrations/migration_lock.toml");
    for (const m of project.migrations) expect(m.sql).not.toMatch(/lawfirm|realestate|atlas|mizan/i);
    expect(project.files.filter((f) => f.startsWith("prisma/schema/")).some((f) => /lawfirm|realestate/.test(f))).toBe(false);
  });

  it("creates exactly the selected modules' tables — nothing else", async () => {
    expect(await tableNames(owner)).toEqual(expectedTables);
  });

  it("enables + forces RLS on exactly the tables the modules declare", async () => {
    const declared = expectedManifests
      .flatMap((m) => m.sql.rls.map((f) => readFileSync(join(repoRoot, "core", f), "utf8")))
      .flatMap((sql) => [
        ...[...sql.matchAll(/ALTER TABLE "?(\w+)"?\s+ENABLE ROW LEVEL SECURITY/g)].map((x) => x[1]!),
        ...[...sql.matchAll(/ARRAY\[([^\]]+)\]/g)].flatMap((x) => [...x[1]!.matchAll(/'(\w+)'/g)].map((y) => y[1]!)),
      ])
      .sort();
    const snap = await snapshot(owner);
    const actual = snap.rls.filter((r) => r.includes("enabled=true")).map((r) => r.split(" ")[0]!).sort();
    expect(actual).toEqual([...new Set(declared)].sort());
    expect(snap.rls.filter((r) => r.includes("enabled=true") && !r.includes("forced=true"))).toEqual([]);
  });

  it("SECURITY INVARIANT: every table with an organization_id column is RLS-protected and has a policy", async () => {
    await withClient(owner, async (c) => {
      const { rows } = await c.query(`
        SELECT t.table_name AS name,
               cl.relrowsecurity AS enabled, cl.relforcerowsecurity AS forced,
               (SELECT count(*) FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = t.table_name)::int AS policies
        FROM information_schema.columns t
        JOIN pg_class cl ON cl.relname = t.table_name AND cl.relnamespace = 'public'::regnamespace
        WHERE t.table_schema = 'public' AND t.column_name = 'organization_id'`);
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        expect(r, `${r.name} must be tenant-protected`).toMatchObject({ enabled: true, forced: true });
        expect(r.policies, `${r.name} policies`).toBeGreaterThan(0);
      }
    });
  });

  it("creates the runtime roles with the right RLS attributes", async () => {
    const snap = await snapshot(owner);
    expect(snap.roles).toEqual(["auric_app bypassrls=false", "auric_system bypassrls=true"]);
    expect(snap.extensions).toEqual(["citext"]);
  });

  it("enforces a database CHECK from a base module (users.status)", async () => {
    await withClient(owner, async (c) => {
      await expect(
        c.query(
          `INSERT INTO users (id, email, email_normalized, password_hash, status) VALUES ('u_bad','a@b.c','a@b.c','x','bogus')`,
        ),
      ).rejects.toThrow(/users_status_check/);
    });
  });

  it("keeps audit_logs append-only", async () => {
    await withClient(owner, async (c) => {
      await c.query(INSERTS.audit_logs!("imm1", "org_a"));
      await expect(c.query(`UPDATE audit_logs SET action = 'tampered' WHERE id = 'imm1'`)).rejects.toThrow(/append-only/);
      await expect(c.query(`DELETE FROM audit_logs WHERE id = 'imm1'`)).rejects.toThrow(/append-only/);
    });
  });

  // The backstop the whole tenancy model rests on, exercised as the real
  // non-bypass runtime role rather than the (RLS-exempt) superuser.
  for (const table of Object.keys(INSERTS)) {
    const owns = expectedManifests.some((m) => m.tables.includes(table));
    it.skipIf(!owns)(`tenant isolation holds on ${table} as auric_app`, async () => {
      await withClient(owner, async (c) => {
        await c.query(INSERTS[table]!(`iso_a_${table}`, "org_a"));
        await c.query(INSERTS[table]!(`iso_b_${table}`, "org_b"));
      });

      await withClient(urlFor(new URL(owner).pathname.slice(1), "auric_app", APP_PASSWORD), async (c) => {
        const visible = async (org: string | null) => {
          await c.query("BEGIN");
          if (org) await c.query(`SELECT set_config('app.organization_id', $1, true)`, [org]);
          const r = await c.query(`SELECT id FROM ${table} WHERE id LIKE 'iso_%'`);
          await c.query("ROLLBACK");
          return r.rows.map((x: { id: string }) => x.id);
        };
        expect(await visible("org_a")).toEqual([`iso_a_${table}`]);
        expect(await visible("org_b")).toEqual([`iso_b_${table}`]);
        expect(await visible(null), "no tenant context sees nothing").toEqual([]);

        // WITH CHECK: cannot write into another tenant.
        await c.query("BEGIN");
        await c.query(`SELECT set_config('app.organization_id', 'org_a', true)`);
        await expect(c.query(INSERTS[table]!(`iso_evil_${table}`, "org_b"))).rejects.toThrow(/row-level security/);
        await c.query("ROLLBACK");
      });
    });
  }
});
