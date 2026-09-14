import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { getConfig } from "@core/kernel/config.js";
import { rootLogger } from "@core/kernel/logging/logger.js";

/**
 * Atlas's own migration runner — deliberately NOT a re-export of
 * `@core/kernel/db/migrate.js`. That file hardcodes its `packageRoot` as three
 * directories up from its own location, i.e. always the repo root (Mizan's
 * `prisma/` project). Reusing it here would run `prisma migrate deploy`
 * against the wrong schema/migrations directory. This is a small, deliberate,
 * zero-Core-touch duplication (~30 lines) of the same "shell the bundled
 * prisma CLI" approach, pointed at THIS package's own `prisma.config.ts` /
 * `prisma/` instead.
 *
 *   npm run migrate           # apply all pending (prisma migrate deploy)
 *   npm run migrate:status    # show migration state
 *
 * To author a new migration during development: `npx prisma migrate dev --name <change>`.
 */

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

/** …/atlas/backend/scripts → package root, where `prisma.config.ts` and `prisma/` are. */
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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

export async function migrateToLatest(databaseUrl?: string): Promise<void> {
  const { stdout } = await runPrisma(["migrate", "deploy"], databaseUrl);
  rootLogger.info({ prisma: stdout }, "prisma migrate deploy");
}

export async function migrationStatus(databaseUrl?: string): Promise<string> {
  const { stdout } = await runPrisma(["migrate", "status"], databaseUrl);
  return stdout;
}

async function main() {
  const command = process.argv[2] ?? "up";
  const { databaseUrl } = getConfig();

  if (command === "status") {
    console.log(await migrationStatus(databaseUrl));
    return;
  }

  if (command === "down") {
    console.error(
      "`migrate:down` doesn't exist — Prisma migrations roll forward. Add a new migration to reverse a change.",
    );
    process.exitCode = 1;
    return;
  }

  await migrateToLatest(databaseUrl);
  console.log("✓ database is up to date");
}

// Only run as a CLI when invoked directly (also imported by main.ts for the boot-time migrate).
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
