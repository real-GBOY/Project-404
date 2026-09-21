import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { trackChild, trackDir } from "./cleanup.js";
import type { Manifest } from "./manifest.js";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

export interface PrismaRun {
  cwd: string;
  env?: Record<string, string>;
}

/** Runs the Prisma CLI (the `prisma` package, resolved from this package's own dependencies). */
export async function runPrisma(args: string[], run: PrismaRun): Promise<string> {
  const cli = require.resolve("prisma/build/index.js");
  try {
    const pending = execFileAsync(process.execPath, [cli, ...args], {
      cwd: run.cwd,
      env: { ...process.env, ...run.env },
      maxBuffer: 32 * 1024 * 1024,
    });
    const release = trackChild(pending.child);
    try {
      return (await pending).stdout;
    } finally {
      release();
    }
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const detail = [e.stdout, e.stderr].filter(Boolean).join("\n").trim() || e.message || String(err);
    throw new Error(`prisma ${args.join(" ")} failed:\n${detail}`);
  }
}

/**
 * A throwaway Prisma config for offline commands. `migrate diff` needs a config
 * that HAS a datasource, or it silently prints nothing — the URL is never
 * connected to (diff --from-empty --to-schema is purely offline).
 */
async function withOfflineConfig<T>(schemaDir: string, fn: (configPath: string, dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "auric-prisma-"));
  const release = trackDir(dir);
  const configPath = join(dir, "prisma.config.mjs");
  await writeFile(
    configPath,
    `export default { schema: ${JSON.stringify(schemaDir)}, ` +
      `datasource: { url: "postgresql://offline:offline@localhost:5432/offline" } };\n`,
  );
  try {
    return await fn(configPath, dir);
  } finally {
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    release();
  }
}

/** `CREATE TABLE …` etc. for the whole schema folder, from an empty database. Offline. */
export function prismaBaselineSql(schemaDir: string): Promise<string> {
  return withOfflineConfig(schemaDir, async (config, dir) => {
    const out = join(dir, "baseline.sql");
    await runPrisma(
      ["migrate", "diff", "--config", config, "--from-empty", "--to-schema", schemaDir, "--script", "--output", out],
      { cwd: tmpdir() },
    );
    const sql = (await readFile(out, "utf8")).trim();
    if (!sql) throw new Error(`prisma migrate diff produced no SQL for ${schemaDir}`);
    return sql;
  });
}

/** `prisma validate` for a schema folder (offline). Throws with Prisma's message when invalid. */
export function validatePrismaSchema(schemaDir: string): Promise<void> {
  return withOfflineConfig(schemaDir, async (config) => {
    await runPrisma(["validate", "--config", config, "--schema", schemaDir], { cwd: tmpdir() });
  });
}

export interface GeneratedMigration {
  /** Directory name, e.g. `20260921120000_auric_baseline`. */
  name: string;
  sql: string;
}

export function migrationTimestamp(at: Date): string {
  return at.toISOString().replace(/\.\d+Z$/, "").replace(/[-:T]/g, "");
}

function readFragments(coreDir: string, paths: readonly string[], banner: string, moduleName: string): string {
  return paths
    .map((rel) => {
      const file = join(coreDir, rel);
      if (!existsSync(file)) throw new Error(`Module "${moduleName}" lists SQL fragment ${rel}, which does not exist`);
      const body = readFileSync(file, "utf8").trim();
      return `-- ── ${moduleName}: ${banner} ${"─".repeat(Math.max(4, 60 - moduleName.length - banner.length))}\n${body}`;
    })
    .join("\n\n");
}

export interface AssembleMigrationsInput {
  coreDir: string;
  /** Selected manifests, in install order (base first). */
  manifests: readonly Manifest[];
  /** Output of {@link prismaBaselineSql} for the assembled schema. */
  tablesSql: string;
  at: Date;
}

/**
 * The developer-owned migration history, as two migrations:
 *
 *   <ts>_auric_baseline   prelude → Prisma tables → constraints/triggers/indexes
 *   <ts+1s>_auric_security  roles + grants → row-level security policies
 *
 * Only the selected modules contribute a fragment; nothing here names a product.
 * The split mirrors the monorepo's own ("constraints" then "multitenancy_rls")
 * but is generated fresh, so there is no history to backfill.
 */
export function assembleMigrations(input: AssembleMigrationsInput): GeneratedMigration[] {
  const { coreDir, manifests, tablesSql, at } = input;
  const modules = manifests.map((m) => m.name).join(", ");
  const section = (pick: (m: Manifest) => string[], banner: string) =>
    manifests
      .map((m) => (pick(m).length > 0 ? readFragments(coreDir, pick(m), banner, m.name) : ""))
      .filter(Boolean)
      .join("\n\n");

  const header = (title: string) =>
    [
      `-- AURIC — ${title}`,
      `-- Modules: ${modules}`,
      `--`,
      `-- Generated by create-auric. From here this migration history is YOURS: edit it before`,
      `-- first deploy, and add later changes as new migrations (\`prisma migrate dev\`).`,
    ].join("\n");

  const baseline = [
    header("clean baseline"),
    section((m) => m.sql.prelude, "prelude"),
    `-- ── tables, keys and plain indexes — generated from prisma/schema/*.prisma ─────────\n${tablesSql}`,
    section((m) => m.sql.constraints, "constraints, triggers, indexes"),
  ]
    .filter(Boolean)
    .join("\n\n");

  const security = [
    header("tenant security (roles + row-level security)"),
    section((m) => m.sql.roles, "roles and grants"),
    section((m) => m.sql.rls, "row-level security"),
  ]
    .filter(Boolean)
    .join("\n\n");

  return [
    { name: `${migrationTimestamp(at)}_auric_baseline`, sql: `${baseline}\n` },
    { name: `${migrationTimestamp(new Date(at.getTime() + 1000))}_auric_security`, sql: `${security}\n` },
  ];
}

/**
 * Tables that end up with row-level security, read from the modules' RLS fragments
 * (`ALTER TABLE … ENABLE ROW LEVEL SECURITY`, or the `ARRAY[…]` of a DO-block).
 */
export function rlsTables(coreDir: string, manifests: readonly Manifest[]): string[] {
  const tables = new Set<string>();
  for (const m of manifests) {
    for (const rel of m.sql.rls) {
      const sql = readFileSync(join(coreDir, rel), "utf8");
      for (const x of sql.matchAll(/ALTER TABLE "?(\w+)"?\s+ENABLE ROW LEVEL SECURITY/g)) tables.add(x[1]!);
      for (const x of sql.matchAll(/ARRAY\[([^\]]+)\]/g)) for (const y of x[1]!.matchAll(/'(\w+)'/g)) tables.add(y[1]!);
    }
  }
  return [...tables].sort();
}
