import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { rootLogger } from "../logging/logger.js";

/**
 * Migration runner. Plan §2: **Prisma owns the migration history**. The schema
 * is defined in `prisma/schema/*.prisma`; migrations live in
 * `prisma/migrations/`. Kysely stays the runtime query builder — it no longer
 * migrates.
 *
 * `prisma migrate deploy` is Prisma's only supported way to apply migrations
 * in a non-interactive environment, so we run the CLI as a child process
 * (bundled `prisma` dependency) with `AURIC_DATABASE_URL` pointed at the
 * caller's database — `prisma.config.ts` reads it from there. This keeps
 * `core.migrate()`, `npm run migrate`, and a standalone
 * `prisma migrate deploy` in CI all driving the same state.
 */

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

/** …/core/kernel/db → package root, where `prisma.config.ts` and `prisma/` are. */
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

interface PrismaResult {
  stdout: string;
  stderr: string;
}

async function runPrisma(args: string[], databaseUrl?: string): Promise<PrismaResult> {
  const prismaCli = require.resolve("prisma/build/index.js");
  const env = { ...process.env };
  if (databaseUrl) env.AURIC_DATABASE_URL = databaseUrl;

  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [prismaCli, ...args], {
      cwd: packageRoot,
      env,
    });
    return { stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const detail =
      [e.stdout, e.stderr].filter(Boolean).join("\n").trim() || e.message || String(err);
    throw new Error(`prisma ${args.join(" ")} failed:\n${detail}`);
  }
}

/** Apply every pending migration. Idempotent; safe to run on every boot. */
export async function migrateToLatest(databaseUrl?: string): Promise<void> {
  const { stdout } = await runPrisma(["migrate", "deploy"], databaseUrl);
  rootLogger.info({ prisma: stdout }, "prisma migrate deploy");
}

/** Human-readable migration state (used by `npm run migrate:status`). */
export async function migrationStatus(databaseUrl?: string): Promise<string> {
  const { stdout } = await runPrisma(["migrate", "status"], databaseUrl);
  return stdout;
}
