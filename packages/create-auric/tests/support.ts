import { mkdirSync, mkdtempSync, rmSync, rmdirSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { runPrisma } from "../src/database.js";
import { generateProject, type GenerateResult } from "../src/project.js";

export const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

/** A superuser connection to a throwaway-capable Postgres (the same one Core's own tests use). */
export const ADMIN_URL =
  process.env.AURIC_TEST_DATABASE_URL ??
  (process.env.CI ? undefined : "postgres://postgres:postgres@localhost:5432/auric_test");

export const APP_PASSWORD = "auric_app_test";
export const SYSTEM_PASSWORD = "auric_system_test";

export async function canConnect(): Promise<boolean> {
  if (!ADMIN_URL) return false;
  const c = new pg.Client({ connectionString: ADMIN_URL });
  try {
    await c.connect();
    await c.end();
    return true;
  } catch {
    return false;
  }
}

export function urlFor(database: string, user?: string, password?: string): string {
  const u = new URL(ADMIN_URL!);
  u.pathname = `/${database}`;
  if (user) u.username = user;
  if (password) u.password = password;
  return u.toString();
}

/** Creates an empty database named `name` (dropping any leftover), returns its owner URL. */
export async function createDatabase(name: string): Promise<string> {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end();
  }
  return urlFor(name);
}

export async function dropDatabase(name: string): Promise<void> {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  } finally {
    await admin.end();
  }
}

/** Gives the runtime roles a login, the way `scripts/provision-db.ts` does in a real deploy. */
export async function provisionRoles(databaseUrl: string): Promise<void> {
  const c = new pg.Client({ connectionString: databaseUrl });
  await c.connect();
  try {
    await c.query(`ALTER ROLE "auric_app" LOGIN PASSWORD '${APP_PASSWORD}' NOBYPASSRLS`);
    await c.query(`ALTER ROLE "auric_system" LOGIN PASSWORD '${SYSTEM_PASSWORD}' BYPASSRLS`);
  } finally {
    await c.end();
  }
}

export interface ScaffoldedProject extends GenerateResult {
  /** Removes the generated directory (best effort — see {@link scaffold}). */
  cleanup: () => Promise<void>;
}

/**
 * Scaffolds into a temp directory and links the monorepo's `node_modules` into it,
 * so the project's own `prisma.config.ts` / `tsc` / `vitest` resolve without an
 * `npm install` per test. (A junction: no privileges needed on Windows.)
 */
export async function scaffold(
  name: string,
  modules: string[],
  opts: { types?: boolean } = {},
): Promise<ScaffoldedProject> {
  const outDir = mkdtempSync(join(tmpdir(), `auric-${name}-`));
  // Kysely types are slow-ish and only the compile/run suites need them.
  const result = await generateProject({ repoRoot, outDir, projectName: name, modules, kyselyTypes: opts.types ?? false });
  symlinkSync(join(repoRoot, "node_modules"), join(outDir, "node_modules"), "junction");
  return {
    ...result,
    cleanup: async () => {
      // Drop the junction first: a recursive rm must never walk into the monorepo's node_modules.
      // `rmdir` removes only the link (on Windows `unlink` refuses a directory junction with EPERM).
      try {
        rmdirSync(join(outDir, "node_modules"));
      } catch {
        /* already gone */
      }
      // Windows keeps a directory locked for a moment after the last child process using it exits.
      // Temp-dir cleanup must never fail a test run, so retry patiently and then give up quietly.
      for (let attempt = 0; attempt < 20; attempt++) {
        try {
          rmSync(outDir, { recursive: true, force: true });
          return;
        } catch {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
      console.warn(`could not remove ${outDir}; delete it manually`);
    },
  };
}

/** Applies the generated migrations exactly the way a deployment would. */
export async function migrateDeploy(projectDir: string, databaseUrl: string): Promise<string> {
  return runPrisma(["migrate", "deploy"], { cwd: projectDir, env: { AURIC_DATABASE_URL: databaseUrl } });
}

// ── schema snapshot ────────────────────────────────────────────────────────

export interface Snapshot {
  columns: string[];
  constraints: string[];
  indexes: string[];
  triggers: string[];
  policies: string[];
  rls: string[];
  functions: string[];
  grants: string[];
  extensions: string[];
  roles: string[];
}

/**
 * A normalised picture of everything security- and correctness-relevant in a
 * database. Two databases with equal snapshots enforce the same rules. Tables
 * matching `exclude` (product tables) and Prisma's bookkeeping are left out.
 */
export async function snapshot(databaseUrl: string, exclude: RegExp = /^lawfirm_/): Promise<Snapshot> {
  const c = new pg.Client({ connectionString: databaseUrl });
  await c.connect();
  try {
    const keep = (table: string) => table !== "_prisma_migrations" && !exclude.test(table);
    const rows = async (sql: string) => (await c.query(sql)).rows as Array<Record<string, string | null>>;

    const columns = (
      await rows(`SELECT table_name t, column_name c, udt_name u, is_nullable n, column_default d
                  FROM information_schema.columns WHERE table_schema = 'public'`)
    )
      .filter((r) => keep(r.t!))
      .map((r) => `${r.t}.${r.c} ${r.u} null=${r.n} default=${r.d ?? "-"}`);

    // Unique constraints are compared as indexes (a UNIQUE constraint and a UNIQUE INDEX are the same rule).
    // NOT NULL rows (PG18 lists them as named constraints) are skipped: nullability is compared through
    // `columns`, and the names are noise (a renamed table keeps its old NOT NULL names).
    const constraints = (
      await rows(`SELECT conrelid::regclass::text t, conname n, contype k, pg_get_constraintdef(oid) d
                  FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND contype NOT IN ('u', 'n')`)
    )
      .filter((r) => keep(r.t!))
      .map((r) => `${r.t} ${r.n} ${r.k} ${r.d}`);

    const indexes = (
      await rows(`SELECT tablename t, indexname n, indexdef d FROM pg_indexes WHERE schemaname = 'public'`)
    )
      .filter((r) => keep(r.t!))
      .map((r) => `${r.t} ${r.n} ${r.d!.replace(/\s+/g, " ")}`);

    const triggers = (
      await rows(`SELECT tgrelid::regclass::text t, tgname n, pg_get_triggerdef(oid) d
                  FROM pg_trigger WHERE NOT tgisinternal`)
    )
      .filter((r) => keep(r.t!))
      .map((r) => `${r.t} ${r.n} ${r.d}`);

    const policies = (
      await rows(`SELECT tablename t, policyname n, permissive p, roles::text r, cmd c, qual q, with_check w
                  FROM pg_policies WHERE schemaname = 'public'`)
    )
      .filter((r) => keep(r.t!))
      .map((r) => `${r.t} ${r.n} ${r.p} ${r.r} ${r.c} using=${r.q ?? "-"} check=${r.w ?? "-"}`);

    const rls = (
      await rows(`SELECT relname t, relrowsecurity e, relforcerowsecurity f
                  FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'`)
    )
      .filter((r) => keep(r.t!))
      .map((r) => `${r.t} enabled=${r.e} forced=${r.f}`);

    const functions = (
      await rows(`SELECT proname n, prosrc s FROM pg_proc WHERE pronamespace = 'public'::regnamespace`)
    ).map((r) => `${r.n} ${r.s!.replace(/\s+/g, " ").trim()}`);

    const grants = (
      await rows(`SELECT grantee g, table_name t, string_agg(privilege_type, ',' ORDER BY privilege_type) p
                  FROM information_schema.role_table_grants
                  WHERE table_schema = 'public' AND grantee IN ('auric_app', 'auric_system')
                  GROUP BY grantee, table_name`)
    )
      .filter((r) => keep(r.t!))
      .map((r) => `${r.g} ${r.t} ${r.p}`);

    const extensions = (await rows(`SELECT extname n FROM pg_extension WHERE extname <> 'plpgsql'`)).map((r) => r.n!);
    const roles = (
      await rows(`SELECT rolname n, rolbypassrls b FROM pg_roles WHERE rolname IN ('auric_app', 'auric_system')`)
    ).map((r) => `${r.n} bypassrls=${r.b}`);

    const sort = (a: string[]) => [...a].sort();
    return {
      columns: sort(columns),
      constraints: sort(constraints),
      indexes: sort(indexes),
      triggers: sort(triggers),
      policies: sort(policies),
      rls: sort(rls),
      functions: sort(functions),
      grants: sort(grants),
      extensions: sort(extensions),
      roles: sort(roles),
    };
  } finally {
    await c.end();
  }
}

export async function tableNames(databaseUrl: string): Promise<string[]> {
  const c = new pg.Client({ connectionString: databaseUrl });
  await c.connect();
  try {
    const r = await c.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' ORDER BY 1`,
    );
    return r.rows.map((x: { tablename: string }) => x.tablename);
  } finally {
    await c.end();
  }
}

// ── CLI + packaging helpers ────────────────────────────────────────────────

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
export const stripAnsi = (s: string) => s.replace(ANSI, "");

/** The npm CLI's entry script, so npm can be run with `node` (spawning `npm.cmd` directly fails on Windows). */
export function npmCli(): string {
  const fromEnv = process.env.npm_execpath;
  if (fromEnv && /npm-cli\.js$/.test(fromEnv)) return fromEnv;
  return join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
}

export const packageDir = join(repoRoot, "packages", "create-auric");

async function exec(file: string, args: string[], cwd: string, env: Record<string, string> = {}): Promise<{ stdout: string; stderr: string }> {
  const { execFile } = await import("node:child_process");
  return new Promise((resolve, reject) => {
    execFile(file, args, { cwd, env: { ...process.env, ...env }, maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${file} ${args.join(" ")} failed:\n${stdout}\n${stderr}`));
      else resolve({ stdout, stderr });
    });
  });
}

export const runNpm = (args: string[], cwd: string, env: Record<string, string> = {}) => exec(process.execPath, [npmCli(), ...args], cwd, env);

export interface PackedArtifact {
  tarball: string;
  /** Paths inside the tarball, as `npm pack` reports them. */
  files: string[];
  /** The tarball extracted (its `package/` directory). */
  extracted: string;
  cleanup: () => Promise<void>;
}

let cachedPack: Promise<PackedArtifact> | undefined;

/**
 * Builds and packs the real npm artifact (exactly what `npm publish` would upload) and
 * extracts it. Cached per test file: one build serves every test in the file.
 */
export function packArtifact(): Promise<PackedArtifact> {
  cachedPack ??= (async () => {
    const work = mkdtempSync(join(tmpdir(), "auric-pack-"));
    await exec(process.execPath, [join(packageDir, "scripts", "build.mjs")], packageDir);
    const { stdout } = await runNpm(["pack", "--ignore-scripts", "--json", "--pack-destination", work], packageDir);
    const [info] = JSON.parse(stdout) as Array<{ filename: string; files: Array<{ path: string }> }>;
    const tarball = join(work, info!.filename);
    const unpack = join(work, "unpacked");
    mkdirSync(unpack);
    // Relative paths, run from `work`: GNU tar would read a `C:\…` argument as a remote `host:path`.
    await exec("tar", ["-xzf", info!.filename, "-C", "unpacked"], work);
    return {
      tarball,
      files: info!.files.map((f) => f.path).sort(),
      extracted: join(unpack, "package"),
      cleanup: async () => {
        for (let i = 0; i < 20; i++) {
          try {
            rmSync(work, { recursive: true, force: true });
            return;
          } catch {
            await new Promise((r) => setTimeout(r, 500));
          }
        }
      },
    };
  })();
  return cachedPack;
}
