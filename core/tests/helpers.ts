import pg from "pg";
import { setConfigForTests } from "../kernel/config.js";
import { unitOfWork } from "../kernel/db/db.js";
import { runAsSystem, withContext } from "../kernel/logging/context.js";

/**
 * Integration tests run against a real Postgres (the modular monolith owns
 * its schema, §5). Point them at a throwaway database with
 * AURIC_TEST_DATABASE_URL; without it, integration suites are skipped.
 *
 * Multi-tenancy (§ docs/tenancy.md): the schema is reset and migrated as the
 * superuser (owner), but the Core runs as the lower-privilege `auric_app` /
 * `auric_system` roles, so `FORCE ROW LEVEL SECURITY` is actually exercised —
 * a superuser connection would bypass RLS entirely and prove nothing.
 */
export const TEST_DATABASE_URL =
  process.env.AURIC_TEST_DATABASE_URL ??
  (process.env.CI ? undefined : "postgres://postgres:postgres@localhost:5432/auric_test");

export const hasTestDb = Boolean(TEST_DATABASE_URL);

const TEST_APP_PASSWORD = "auric_app_test";
const TEST_SYSTEM_PASSWORD = "auric_system_test";

function withUser(url: string, user: string, password: string): string {
  const u = new URL(url);
  u.username = user;
  u.password = password;
  return u.toString();
}

export const TEST_APP_DATABASE_URL = TEST_DATABASE_URL
  ? withUser(TEST_DATABASE_URL, "auric_app", TEST_APP_PASSWORD)
  : undefined;
export const TEST_SYSTEM_DATABASE_URL = TEST_DATABASE_URL
  ? withUser(TEST_DATABASE_URL, "auric_system", TEST_SYSTEM_PASSWORD)
  : undefined;

export async function resetSchema(): Promise<void> {
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE");
    await client.query("CREATE SCHEMA public");
    // The migration creates the roles NOLOGIN; give them a login + password so
    // the Core can connect as them for the test run. Idempotent.
    for (const [role, pwd] of [
      ["auric_app", TEST_APP_PASSWORD],
      ["auric_system", TEST_SYSTEM_PASSWORD],
    ] as const) {
      await client.query(
        `DO $$ BEGIN
           IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
             CREATE ROLE "${role}" LOGIN PASSWORD '${pwd}';
           ELSE
             ALTER ROLE "${role}" LOGIN PASSWORD '${pwd}';
           END IF;
         END $$;`,
      );
    }
    await client.query(`ALTER ROLE "auric_system" BYPASSRLS`);
    await client.query(`ALTER ROLE "auric_app" NOBYPASSRLS`);
  } finally {
    await client.end();
  }
}

/**
 * Run a block as if it were an authenticated request from `userId` in
 * `organizationId` (§ docs/tenancy.md): sets the ambient context the way the
 * auth hook would, then opens a transaction so RLS's `SET LOCAL` is applied —
 * the same shape as a real request (guard → use case, both transactional).
 * Tests that call services directly (no HTTP) need this wrapper.
 */
export function asUser<T>(
  userId: string,
  organizationId: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  return withContext({ userId, ...(organizationId ? { organizationId } : {}) }, () =>
    unitOfWork.transaction(() => fn()),
  );
}

/** Run a block in system context (BYPASSRLS) — signup, worker, cross-tenant ops. */
export function asSystem<T>(fn: () => Promise<T>): Promise<T> {
  return runAsSystem(fn);
}

export function applyTestConfig(): void {
  setConfigForTests({
    databaseUrl: TEST_DATABASE_URL!,
    appDatabaseUrl: TEST_APP_DATABASE_URL!,
    systemDatabaseUrl: TEST_SYSTEM_DATABASE_URL!,
    nodeEnv: "test",
    jwtSecret: "test-secret",
    logLevel: "silent",
    outboxPollIntervalMs: 50,
  });
}
