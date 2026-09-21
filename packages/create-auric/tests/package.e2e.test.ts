import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadManifests } from "../src/manifest.js";
import { resolveSelection } from "../src/resolve.js";
import {
  APP_PASSWORD,
  SYSTEM_PASSWORD,
  canConnect,
  createDatabase,
  dropDatabase,
  npmCli,
  packArtifact,
  repoRoot,
  runNpm,
  stripAnsi,
  urlFor,
  type PackedArtifact,
} from "./support.js";

/**
 * The proof that matters: the ARTIFACT works, not just the monorepo.
 *
 *   pack the real tarball → install it into an empty directory from the npm registry →
 *   run `create-auric` there → `npm install` the generated project for real →
 *   typecheck → the project's own tests → migrations → provision roles →
 *   tenant isolation → boot → /api/health
 *
 * Nothing here can see the AURIC repository: the CLI runs from its own node_modules with its
 * bundled Core snapshot, and the generated project resolves its own dependencies.
 *
 * Slow and networked, so opt-in:
 *   AURIC_PACKAGE_E2E=1 npx vitest run packages/create-auric/tests/package.e2e
 *   AURIC_PACKAGE_E2E_ONLY=messaging   # only install sets whose key contains this
 */
const enabled = process.env.AURIC_PACKAGE_E2E === "1" && (await canConnect());
const only = process.env.AURIC_PACKAGE_E2E_ONLY;

const REQUESTS: Record<string, string[]> = {
  "base only": [],
  "base + files": ["files"],
  "base + notifications": ["notifications"],
  "base + messaging": ["messaging"],
  "base + assistant": ["assistant"],
  "full core": ["files", "notifications", "messaging", "assistant"],
};

const manifests = loadManifests(join(repoRoot, "core"));
const distinct = new Map<string, { selected: string[]; labels: string[]; modules: string[] }>();
for (const [label, modules] of Object.entries(REQUESTS)) {
  const { selected } = resolveSelection(manifests, modules);
  const key = selected.join("+");
  const entry = distinct.get(key) ?? { selected, labels: [], modules };
  entry.labels.push(label);
  distinct.set(key, entry);
}

interface Ran {
  code: number | null;
  out: string;
}

/** Runs a command, never throws — the test decides what a failure means. */
function sh(file: string, args: string[], cwd: string, env: Record<string, string> = {}): Promise<Ran> {
  return new Promise((resolve) => {
    const child = spawn(file, args, { cwd, env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0", ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ code, out: stripAnsi(out) }));
  });
}
const node = (args: string[], cwd: string, env?: Record<string, string>) => sh(process.execPath, args, cwd, env);
const npm = (args: string[], cwd: string, env?: Record<string, string>) => node([npmCli(), ...args], cwd, env);

const cleanDir = (dir: string) => {
  for (let i = 0; i < 10; i++) {
    try {
      rmSync(dir, { recursive: true, force: true });
      return;
    } catch {
      /* Windows holds handles briefly */
    }
  }
};

describe.skipIf(!enabled)("the packed npm artifact", () => {
  let art: PackedArtifact;
  let consumer: string;
  let cliBin: string;
  const scratch: string[] = [];

  beforeAll(async () => {
    art = await packArtifact();
    // An empty directory with nothing but the tarball: the situation of a developer who has never seen this repo.
    consumer = mkdtempSync(join(tmpdir(), "auric-consumer-"));
    scratch.push(consumer);
    await runNpm(["init", "-y"], consumer);
    await runNpm(["install", art.tarball, "--no-audit", "--no-fund"], consumer);
    cliBin = join(consumer, "node_modules", "create-auric", "bin", "create-auric.js");
  }, 600_000);

  // Deleting six real node_modules trees takes a while on Windows — far beyond vitest's default 10s hook timeout.
  afterAll(async () => {
    await art?.cleanup();
    for (const d of scratch) cleanDir(d);
  }, 600_000);

  it("installs from a clean directory and answers --version / --help", async () => {
    expect(existsSync(cliBin)).toBe(true);
    const version = await node([cliBin, "--version"], consumer);
    expect(version.code).toBe(0);
    expect(version.out.trim()).toBe((JSON.parse(readFileSync(join(art.extracted, "package.json"), "utf8")) as { version: string }).version);
    const help = await node([cliBin, "--help"], consumer);
    expect(help.code).toBe(0);
    for (const m of ["files", "messaging", "notifications", "assistant"]) expect(help.out).toContain(m);
  });

  it("runs as `npx create-auric` (npm exec) from an empty directory", async () => {
    const work = mkdtempSync(join(tmpdir(), "auric-npx-"));
    scratch.push(work);
    const r = await npm(["exec", "--yes", `--package=${art.tarball}`, "--", "create-auric", "npx-proj", "--yes", "--no-install"], work);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain("AURIC foundation created");
    expect(existsSync(join(work, "npx-proj", "src", "core", "identity"))).toBe(true);
    expect(existsSync(join(work, "npx-proj", "src", "core", "kernel", "db", "schema.ts"))).toBe(true);
  }, 600_000);

  it("refuses to overwrite, and cleans up after itself", async () => {
    const work = mkdtempSync(join(tmpdir(), "auric-guard-"));
    scratch.push(work);
    mkdirSync(join(work, "taken"));
    writeFileSync(join(work, "taken", "keep.txt"), "x");
    const r = await node([cliBin, "taken", "--yes"], work);
    expect(r.code).toBe(1);
    expect(r.out).toContain(`Directory "taken" already exists and isn't empty.`);
    expect(readFileSync(join(work, "taken", "keep.txt"), "utf8")).toBe("x");
  });

  describe.each([...distinct.entries()].filter(([key]) => !only || key.includes(only)))("project %s", (key, combo) => {
    const suffix = key.replace(/[^a-z]+/g, "_").slice(0, 34);
    const testDb = `auric_pkg_test_${suffix}`.slice(0, 60);
    const bootDb = `auric_pkg_boot_${suffix}`.slice(0, 60);
    const expected = combo.selected.map((n) => manifests.find((m) => m.name === n)!);
    let work: string;
    let project: string;

    beforeAll(async () => {
      work = mkdtempSync(join(tmpdir(), "auric-gen-"));
      scratch.push(work);
      project = join(work, "app");
    });
    afterAll(async () => {
      await dropDatabase(testDb);
      await dropDatabase(bootDb);
    });

    it("generates it from the installed package", async () => {
      const args = [cliBin, "app", "--yes", "--no-install", ...(combo.modules.length ? ["--modules", combo.modules.join(",")] : [])];
      const r = await node(args, work);
      expect(r.code, r.out).toBe(0);
      expect(r.out).toContain("AURIC foundation created");
      expect(r.out).toMatch(new RegExp(`${combo.selected.length} modules · ${expected.reduce((n, m) => n + m.tables.length, 0)} tables`));
      // The CLI wrote the typed queries itself — before any install.
      expect(existsSync(join(project, "src", "core", "kernel", "db", "schema.ts"))).toBe(true);
      const lock = JSON.parse(readFileSync(join(project, "auric.json"), "utf8")) as { auric: { version: string }; modules: string[] };
      expect(lock.modules).toEqual(combo.selected);
      expect(lock.auric.version).toBe((JSON.parse(readFileSync(join(art.extracted, "package.json"), "utf8")) as { version: string }).version);
    }, 300_000);

    it("installs ONLY the dependencies its modules need", async () => {
      const r = await npm(["install", "--no-audit", "--no-fund", "--loglevel=error"], project);
      expect(r.code, r.out).toBe(0);
      const has = (pkg: string) => existsSync(join(project, "node_modules", pkg, "package.json"));
      const wants = new Set(expected.flatMap((m) => [...m.npm.dependencies, ...m.npm.devDependencies]));
      for (const pkg of ["socket.io", "nodemailer", "argon2", "@fastify/multipart"]) {
        expect(has(pkg), `${pkg} installed iff a selected module lists it`).toBe(wants.has(pkg));
      }
      // No black-box runtime dependency on AURIC.
      const pkgJson = JSON.parse(readFileSync(join(project, "package.json"), "utf8")) as { dependencies: Record<string, string> };
      expect(Object.keys(pkgJson.dependencies).filter((d) => /auric/i.test(d))).toEqual([]);
      // The native module built (npm's install-scripts policy did not silently skip it).
      const argon = await node(["-e", "const a=require('argon2');a.hash('x').then(()=>console.log('ARGON_OK'))"], project);
      expect(argon.out).toContain("ARGON_OK");
    }, 900_000);

    it("type-checks", async () => {
      const r = await node([join(project, "node_modules", "typescript", "bin", "tsc"), "--noEmit"], project);
      expect(r.code, r.out).toBe(0);
    }, 300_000);

    it("passes its own tests against its own generated migrations", async () => {
      const url = await createDatabase(testDb);
      const r = await node([join(project, "node_modules", "vitest", "vitest.mjs"), "run", "--reporter=dot"], project, {
        AURIC_TEST_DATABASE_URL: url,
        CI: "",
      });
      expect(r.code, r.out.slice(-3000)).toBe(0);
      expect(r.out).toMatch(/Tests\s+\d+ passed/);
      expect(r.out).not.toMatch(/Tests[^\n]*\d+ failed/);
    }, 900_000);

    // The README's first step is `cp .env.example .env`. That file ships secrets as CHANGE_ME placeholders, and Core
    // loads `.env` into the environment — a live-service test that mistook a placeholder for a credential then called
    // real Cloudflare and failed (11 tests). Following the docs must leave the project's own suite green.
    it("still passes its own tests after `cp .env.example .env`, as the README says", async () => {
      const url = await createDatabase(testDb);
      const dotenv = join(project, ".env");
      copyFileSync(join(project, ".env.example"), dotenv);
      try {
        const r = await node([join(project, "node_modules", "vitest", "vitest.mjs"), "run", "--reporter=dot"], project, {
          AURIC_TEST_DATABASE_URL: url,
          CI: "",
        });
        expect(r.code, r.out.slice(-3000)).toBe(0);
        expect(r.out).not.toMatch(/Tests[^\n]*\d+ failed/);
      } finally {
        rmSync(dotenv, { force: true });
      }
    }, 900_000);

    it("migrates, provisions roles, enforces tenant isolation, boots and answers /api/health", async () => {
      const owner = await createDatabase(bootDb);
      const env = {
        AURIC_DATABASE_URL: owner,
        AURIC_APP_DB_PASSWORD: APP_PASSWORD,
        AURIC_SYSTEM_DB_PASSWORD: SYSTEM_PASSWORD,
      };
      const migrate = await npm(["run", "migrate"], project, env);
      expect(migrate.code, migrate.out).toBe(0);
      const provision = await npm(["run", "provision-db"], project, env);
      expect(provision.code, provision.out).toBe(0);

      // Row-level security, as the real runtime role.
      const admin = new pg.Client({ connectionString: owner });
      await admin.connect();
      await admin.query(
        `INSERT INTO audit_logs (id, action, resource_type, organization_id) VALUES ('a1','x','x','org_a'), ('b1','x','x','org_b')`,
      );
      await admin.end();
      const app = new pg.Client({ connectionString: urlFor(bootDb, "auric_app", APP_PASSWORD) });
      await app.connect();
      await app.query("BEGIN");
      await app.query(`SELECT set_config('app.organization_id','org_a',true)`);
      const visible = (await app.query(`SELECT id FROM audit_logs`)).rows.map((r: { id: string }) => r.id);
      await app.query("ROLLBACK");
      const none = (await app.query(`SELECT id FROM audit_logs`)).rows;
      await app.end();
      expect(visible).toEqual(["a1"]);
      expect(none).toEqual([]);

      // Boot the app exactly as the project's own `serve` script does.
      const serve = (JSON.parse(readFileSync(join(project, "package.json"), "utf8")) as { scripts: Record<string, string> }).scripts.serve!;
      const nodeArgs = serve.replace(/^node /, "").split(" ");
      const port = 4600 + Math.floor(Math.random() * 300);
      const child = spawn(process.execPath, nodeArgs, {
        cwd: project,
        env: {
          ...process.env,
          NODE_ENV: "development",
          AURIC_PORT: String(port),
          AURIC_LOG_LEVEL: "warn",
          AURIC_DATABASE_URL: owner,
          AURIC_APP_DATABASE_URL: urlFor(bootDb, "auric_app", APP_PASSWORD),
          AURIC_SYSTEM_DATABASE_URL: urlFor(bootDb, "auric_system", SYSTEM_PASSWORD),
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let log = "";
      child.stdout.on("data", (d) => (log += d));
      child.stderr.on("data", (d) => (log += d));
      const exited = new Promise((r) => child.on("exit", r));
      try {
        let status = 0;
        const deadline = Date.now() + 120_000;
        while (Date.now() < deadline && status !== 200) {
          if (child.exitCode !== null) throw new Error(`app exited early (${child.exitCode}):\n${log}`);
          try {
            status = (await fetch(`http://127.0.0.1:${port}/api/health`)).status;
          } catch {
            await new Promise((r) => setTimeout(r, 500));
          }
        }
        expect(status, `no healthy response:\n${log}`).toBe(200);
      } finally {
        child.kill();
        await Promise.race([exited, new Promise((r) => setTimeout(r, 5000))]);
      }
    }, 600_000);

    it("regenerates byte-identical typed queries with the project's own Prisma", async () => {
      const file = join(project, "src", "core", "kernel", "db", "schema.ts");
      const before = readFileSync(file, "utf8");
      // The project's own script, its own installed prisma + prisma-kysely (not the CLI's copy).
      const r = await npm(["run", "db:generate"], project, { AURIC_DATABASE_URL: "postgresql://offline:offline@localhost:5432/offline" });
      expect(r.code, r.out).toBe(0);
      expect(readFileSync(file, "utf8")).toBe(before);
    }, 300_000);

    it("builds for production and boots from dist/ (migrating through the built code)", async () => {
      const build = await npm(["run", "build"], project);
      expect(build.code, build.out).toBe(0);
      for (const f of ["dist/main.js", "dist/prisma.config.ts", "dist/prisma/migrations", "dist/core/app.module.js"]) {
        expect(existsSync(join(project, f)), f).toBe(true);
      }
      // No path aliases may survive into the built JavaScript.
      expect(readFileSync(join(project, "dist", "main.js"), "utf8")).not.toContain("@core/");

      const owner = urlFor(bootDb);
      const port = 4900 + Math.floor(Math.random() * 300);
      const child = spawn(process.execPath, ["dist/main.js"], {
        cwd: project,
        env: {
          ...process.env,
          NODE_ENV: "production",
          AURIC_JWT_SECRET: "release-gate-secret-not-the-default",
          AURIC_PORT: String(port),
          AURIC_LOG_LEVEL: "warn",
          AURIC_DATABASE_URL: owner,
          AURIC_APP_DATABASE_URL: urlFor(bootDb, "auric_app", APP_PASSWORD),
          AURIC_SYSTEM_DATABASE_URL: urlFor(bootDb, "auric_system", SYSTEM_PASSWORD),
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let log = "";
      child.stdout.on("data", (d) => (log += d));
      child.stderr.on("data", (d) => (log += d));
      const exited = new Promise((r) => child.on("exit", r));
      try {
        let status = 0;
        const deadline = Date.now() + 120_000;
        while (Date.now() < deadline && status !== 200) {
          if (child.exitCode !== null) throw new Error(`built app exited early (${child.exitCode}):\n${log}`);
          try {
            status = (await fetch(`http://127.0.0.1:${port}/api/health`)).status;
          } catch {
            await new Promise((r) => setTimeout(r, 500));
          }
        }
        expect(status, `no healthy response from dist/:\n${log}`).toBe(200);
      } finally {
        child.kill();
        await Promise.race([exited, new Promise((r) => setTimeout(r, 5000))]);
      }
    }, 600_000);

    // The developer-ownership promise, proven on the docs' worked example: add your own table that references
    // Core's users/organizations, migrate it, protect it with RLS, and build a feature on it — all without touching AURIC.
    it.skipIf(!combo.selected.includes("messaging"))("lets a developer add their own tenant-scoped domain on top of Core", async () => {
      const schemaDir = join(project, "prisma", "schema");
      writeFileSync(
        join(schemaDir, "property.prisma"),
        `model properties {
  id              String   @id
  organization_id String
  owner_id        String
  title           String
  created_at      DateTime @default(now()) @db.Timestamptz(6)

  organization organizations @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  owner        users         @relation(fields: [owner_id], references: [id])

  @@index([organization_id])
  @@map("properties")
}
`,
      );
      // Prisma needs both sides of a relation: the developer edits their own copies of Core's schema.
      for (const [file, anchor] of [
        ["identity.prisma", "  organization_members organization_members[]"],
        ["organizations.prisma", "  organization_members organization_members[]"],
      ] as const) {
        const p = join(schemaDir, file);
        const text = readFileSync(p, "utf8");
        expect(text, `${file} has the anchor line`).toContain(anchor);
        writeFileSync(p, text.replace(anchor, `${anchor}\n  properties properties[]`));
      }

      const gen = await npm(["run", "db:generate"], project, { AURIC_DATABASE_URL: "postgresql://offline:offline@localhost:5432/offline" });
      expect(gen.code, gen.out).toBe(0);
      expect(readFileSync(join(project, "src/core/kernel/db/schema.ts"), "utf8")).toMatch(/properties: properties;/);

      // Their feature, written against Core's own building blocks.
      mkdirSync(join(project, "src", "domain", "property"), { recursive: true });
      writeFileSync(
        join(project, "src", "domain", "property", "property.module.ts"),
        `import { Controller, Get, Injectable, Module, UseGuards } from "@nestjs/common";
import { currentExecutor, readInTenant } from "@core/kernel/db/db.js";
import { createPrefixedId } from "@core/kernel/id.js";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import type { PermissionDefinition } from "@core/rbac/domain/permission.js";

export const propertyPermissions: PermissionDefinition[] = [
  { action: "read", resource: "property", description: "View properties" },
];

@Injectable()
export class PropertyRepository {
  list() {
    return currentExecutor().selectFrom("properties").selectAll().execute();
  }
  create(input: { title: string; ownerId: string }) {
    return currentExecutor()
      .insertInto("properties")
      .values({ id: createPrefixedId("prop"), organization_id: requireOrganizationId(), owner_id: input.ownerId, title: input.title })
      .returningAll()
      .executeTakeFirstOrThrow();
  }
}

@Controller("properties")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PropertyController {
  constructor(private readonly repo: PropertyRepository) {}
  @Get()
  @RequirePermission("read", "property")
  list() {
    return readInTenant(() => this.repo.list());
  }
}

@Module({ controllers: [PropertyController], providers: [PropertyRepository] })
export class PropertyModule {}
`,
      );
      const appModule = join(project, "src", "core", "app.module.ts");
      let app = readFileSync(appModule, "utf8");
      app = app.replace('import { SecurityModule }', 'import { PropertyModule } from "../domain/property/property.module.js";\nimport { SecurityModule }');
      app = app.replace("    SecurityModule,\n  ],", "    SecurityModule,\n    PropertyModule,\n  ],");
      expect(app).toContain("PropertyModule,");
      writeFileSync(appModule, app);

      const tsc = await node([join(project, "node_modules", "typescript", "bin", "tsc"), "--noEmit"], project);
      expect(tsc.code, `the developer's own code must type-check against Core:\n${tsc.out}`).toBe(0);

      // The migration for their table, straight from Prisma against the already-migrated database.
      const owner = urlFor(bootDb);
      const diff = await node(
        [join(project, "node_modules", "prisma", "build", "index.js"), "migrate", "diff", "--from-config-datasource", "--to-schema", "prisma/schema", "--script"],
        project,
        { AURIC_DATABASE_URL: owner },
      );
      expect(diff.code, diff.out).toBe(0);
      expect(diff.out).toContain('CREATE TABLE "properties"');
      expect(diff.out).toMatch(/FOREIGN KEY \("organization_id"\) REFERENCES "organizations"/);
      expect(diff.out).toMatch(/FOREIGN KEY \("owner_id"\) REFERENCES "users"/);
      const sql = diff.out.slice(diff.out.indexOf("-- CreateTable"));

      const admin = new pg.Client({ connectionString: owner });
      await admin.connect();
      try {
        await admin.query(sql);
        await admin.query(`
          ALTER TABLE "properties" ENABLE ROW LEVEL SECURITY;
          ALTER TABLE "properties" FORCE  ROW LEVEL SECURITY;
          CREATE POLICY tenant_isolation ON "properties"
            USING      (organization_id = current_setting('app.organization_id', true))
            WITH CHECK (organization_id = current_setting('app.organization_id', true));
          INSERT INTO users (id, email, email_normalized, password_hash, status) VALUES ('u_own','o@x.io','o@x.io','x','active');
          INSERT INTO organizations (id, name, slug) VALUES ('org_a','A','a'), ('org_b','B','b');
          INSERT INTO properties (id, organization_id, owner_id, title) VALUES ('p_a','org_a','u_own','A house'), ('p_b','org_b','u_own','B house');`);
      } finally {
        await admin.end();
      }

      // As the real, non-bypass runtime role: the new table is tenant-isolated with no extra grants needed.
      const app2 = new pg.Client({ connectionString: urlFor(bootDb, "auric_app", APP_PASSWORD) });
      await app2.connect();
      try {
        const seen = async (org: string | null) => {
          await app2.query("BEGIN");
          if (org) await app2.query(`SELECT set_config('app.organization_id', $1, true)`, [org]);
          const rows = (await app2.query(`SELECT id FROM properties`)).rows.map((r: { id: string }) => r.id);
          await app2.query("ROLLBACK");
          return rows;
        };
        expect(await seen("org_a")).toEqual(["p_a"]);
        expect(await seen("org_b")).toEqual(["p_b"]);
        expect(await seen(null)).toEqual([]);
      } finally {
        await app2.end();
      }
    }, 600_000);
  });
});
