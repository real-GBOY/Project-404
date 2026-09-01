import pg from "pg";
import { Test, type TestingModule } from "@nestjs/testing";
import { AppModule } from "../app.module.js";
import { setConfigForTests } from "../kernel/config.js";
import type { Clock } from "../kernel/clock.js";
import { unitOfWork } from "../kernel/db/db.js";
import { runAsSystem, withContext } from "../kernel/logging/context.js";
import {
  CLOCK,
  EMAIL_CHANNEL,
  REQUIRE_EMAIL_VERIFICATION,
  WORKER_AUTOSTART,
} from "../kernel/tokens.js";
import type { EmailChannel } from "../notifications/infrastructure/email-channel.js";
import { migrateToLatest } from "../kernel/db/migrate.js";
import { SeedService } from "../bootstrap/seed.service.js";

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
    appUrl: "https://app.test",
  });
}

export interface TestCoreOptions {
  clock?: Clock;
  emailChannel?: EmailChannel;
  requireEmailVerification?: boolean;
}

/**
 * Boots the whole Nest app for an integration test: resets + migrates the
 * schema (as owner), compiles `AppModule` as `auric_app`, runs the seed, and
 * wires the event subscribers via `init()`. The outbox worker does NOT
 * autostart — tests drive `worker.tick()`.
 */
export async function createTestCore(opts: TestCoreOptions = {}): Promise<TestingModule> {
  applyTestConfig();
  await resetSchema();
  await migrateToLatest(TEST_DATABASE_URL);

  const builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(WORKER_AUTOSTART)
    .useValue(false);
  if (opts.clock) builder.overrideProvider(CLOCK).useValue(opts.clock);
  if (opts.emailChannel) builder.overrideProvider(EMAIL_CHANNEL).useValue(opts.emailChannel);
  if (opts.requireEmailVerification !== undefined) {
    builder.overrideProvider(REQUIRE_EMAIL_VERIFICATION).useValue(opts.requireEmailVerification);
  }

  const moduleRef = await builder.compile();
  await moduleRef.init(); // runs OnModuleInit (subscribers) + OnApplicationBootstrap (worker no-op)
  await get(moduleRef, SeedService).seed();
  return moduleRef;
}

/** `moduleRef.get` across feature modules (providers aren't all in the root). */
export function get<T>(
  moduleRef: TestingModule,
  token: string | symbol | (new (...args: never[]) => T) | (abstract new (...args: never[]) => T),
): T {
  return moduleRef.get<T>(token as never, { strict: false });
}
