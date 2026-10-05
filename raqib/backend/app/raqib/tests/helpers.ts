import { Test, type TestingModule } from "@nestjs/testing";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "@raqib/app.module.js";
import { AppSeedService } from "@raqib/seed.js";
import { configureAuricHttp } from "@core/http/bootstrap.js";
import { getConfig } from "@core/kernel/config.js";
import { CLOCK, REQUIRE_EMAIL_VERIFICATION, WORKER_AUTOSTART } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import {
  applyTestConfig,
  asSystem,
  asUser,
  get,
  hasTestDb,
  resetSchema,
  TEST_DATABASE_URL,
} from "@core/tests/helpers.js";
import { DemoSeeder } from "@raqib/raqib/demo/demo-seeder.js";
import { DEMO_PASSWORD } from "@raqib/raqib/demo/demo-data.js";
import { migrateToLatest } from "../../../scripts/migrate.js";

export { asSystem, asUser, get, hasTestDb };


type TestAppOptions = { clock?: Clock; overrides?: Array<{ token: unknown; value: unknown }> };

/**
 * Resets the schema and re-applies every Raqib migration from zero (via Raqib's own migrate
 * script — Core's `migrateToLatest` targets the repo-root Prisma project), then compiles the whole
 * app (`app/app.module.ts`) without initialising it. The outbox worker never autostarts; drive it
 * with `worker.tick()`.
 */
async function compileRaqib(opts: TestAppOptions): Promise<TestingModule> {
  applyTestConfig();
  await resetSchema();
  await migrateToLatest(TEST_DATABASE_URL);

  const builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(WORKER_AUTOSTART)
    .useValue(false)
    .overrideProvider(REQUIRE_EMAIL_VERIFICATION)
    .useValue(false);
  if (opts.clock) builder.overrideProvider(CLOCK).useValue(opts.clock);
  for (const o of opts.overrides ?? []) {
    builder.overrideProvider(o.token as never).useValue(o.value);
  }
  return builder.compile();
}

/**
 * Boots Raqib for a service-level integration test (no HTTP), then runs the layered seed.
 * Mirrors `atlas/backend/app/realestate/tests/helpers.ts#createRealestateTestApp`.
 */
export async function createRaqibTestApp(opts: TestAppOptions = {}): Promise<TestingModule> {
  const moduleRef = await compileRaqib(opts);
  await moduleRef.init();
  await get<AppSeedService>(moduleRef, AppSeedService).seed();
  return moduleRef;
}

export interface RaqibHttpTestApp {
  moduleRef: TestingModule;
  http: NestFastifyApplication;
  close(): Promise<void>;
}

/**
 * Boots Raqib behind a real Fastify HTTP server configured with exactly the conventions
 * production uses (`configureAuricHttp`: `/api` prefix, body limits, CORS), then seeds. Use it for
 * tests that must go through guards, Zod pipes and the exception filter — authorization tests in
 * particular — via `http.inject(...)`. The module is initialised once, through the HTTP app.
 */
export async function createRaqibHttpTestApp(opts: TestAppOptions = {}): Promise<RaqibHttpTestApp> {
  const moduleRef = await compileRaqib(opts);
  const http = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ bodyLimit: 1_048_576 }),
  );
  await configureAuricHttp(http, getConfig());
  await http.init();
  await http.getHttpAdapter().getInstance().ready();
  await get<AppSeedService>(moduleRef, AppSeedService).seed();
  return { moduleRef, http, close: () => http.close() };
}

/** POST /api/auth/login and return the bearer access token. Throws on a non-2xx. */
export async function loginAs(
  http: NestFastifyApplication,
  email: string,
  password = DEMO_PASSWORD,
): Promise<string> {
  const res = await http.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`login failed for ${email}: ${res.statusCode} ${res.body}`);
  }
  return (res.json() as { tokens: { accessToken: string } }).tokens.accessToken;
}

/**
 * Boots Raqib with HTTP, then seeds the demo organization through the real seeder (RAQIB_SEED_DEMO is
 * pinned to false in vitest.config, so suites opt in explicitly). Every demo person signs in with
 * DEMO_PASSWORD.
 */
export async function createDemoHttpApp(opts: TestAppOptions = {}): Promise<RaqibHttpTestApp> {
  const app = await createRaqibHttpTestApp(opts);
  await get<DemoSeeder>(app.moduleRef, DemoSeeder).seed(get<Clock>(app.moduleRef, CLOCK));
  return app;
}

export { DEMO_PASSWORD };
