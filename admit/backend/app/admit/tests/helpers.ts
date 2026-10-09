import { Test, type TestingModule } from "@nestjs/testing";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "@admit/app.module.js";
import { AppSeedService } from "@admit/seed.js";
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
import { IdentityService } from "@core/identity/application/identity-service.js";
import { OrganizationService } from "@core/organizations/application/organization-service.js";
import { RbacService } from "@core/rbac/application/rbac-service.js";
import { migrateToLatest } from "../../../scripts/migrate.js";

export { asSystem, asUser, get, hasTestDb };

export const TEST_PASSWORD = "correct horse battery staple";

type TestAppOptions = { clock?: Clock; overrides?: Array<{ token: unknown; value: unknown }> };

/**
 * Resets the schema and re-applies every Admit migration from zero (via Admit's own migrate
 * script — Core's `migrateToLatest` targets the repo-root Prisma project), then compiles the whole
 * app (`app/app.module.ts`) without initialising it. The outbox worker never autostarts; drive it
 * with `worker.tick()`.
 */
async function compileAdmit(opts: TestAppOptions): Promise<TestingModule> {
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
 * Boots Admit for a service-level integration test (no HTTP), then runs the layered seed.
 * Mirrors `atlas/backend/app/realestate/tests/helpers.ts#createRealestateTestApp`.
 */
export async function createAdmitTestApp(opts: TestAppOptions = {}): Promise<TestingModule> {
  const moduleRef = await compileAdmit(opts);
  await moduleRef.init();
  await get<AppSeedService>(moduleRef, AppSeedService).seed();
  return moduleRef;
}

export interface AdmitHttpTestApp {
  moduleRef: TestingModule;
  http: NestFastifyApplication;
  close(): Promise<void>;
}

/**
 * Boots Admit behind a real Fastify HTTP server configured with exactly the conventions
 * production uses (`configureAuricHttp`: `/api` prefix, body limits, CORS), then seeds. Use it for
 * tests that must go through guards, Zod pipes and the exception filter — authorization tests in
 * particular — via `http.inject(...)`. The module is initialised once, through the HTTP app.
 */
export async function createAdmitHttpTestApp(opts: TestAppOptions = {}): Promise<AdmitHttpTestApp> {
  const moduleRef = await compileAdmit(opts);
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
  password = TEST_PASSWORD,
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

export interface SeededOrganizer {
  orgId: string;
  /** The organization slug — how the public site names this organizer. */
  slug: string;
  ownerId: string;
  ownerEmail: string;
}

let seq = 0;

/** Register an owner, create their organizer organization, and grant the `owner` role. */
export async function seedOrganizer(app: TestingModule, name = "Test Organizer"): Promise<SeededOrganizer> {
  const identity = get<IdentityService>(app, IdentityService);
  const orgs = get<OrganizationService>(app, OrganizationService);
  const rbac = get<RbacService>(app, RbacService);

  const ownerEmail = `owner+${Date.now()}-${seq++}@admit.test`;
  const owner = await identity.register({
    email: ownerEmail,
    password: TEST_PASSWORD,
    displayName: "Organizer Owner",
  });
  const org = await orgs.createOrganization({ name, createdBy: owner.id });
  await asSystem(() => rbac.assignRole(owner.id, "owner", owner.id, org.id));
  return { orgId: org.id, slug: org.slug, ownerId: owner.id, ownerEmail };
}

/** Register another user, add them to the organizer, and grant `roleKey`. Returns id + email. */
export async function seedStaff(
  app: TestingModule,
  org: SeededOrganizer,
  roleKey: string,
  displayName = "Staff Member",
): Promise<{ userId: string; email: string }> {
  const identity = get<IdentityService>(app, IdentityService);
  const orgs = get<OrganizationService>(app, OrganizationService);
  const rbac = get<RbacService>(app, RbacService);

  const email = `staff+${Date.now()}-${seq++}@admit.test`;
  const user = await identity.register({ email, password: TEST_PASSWORD, displayName });
  await asUser(org.ownerId, org.orgId, () =>
    orgs.addMember({ organizationId: org.orgId, userId: user.id, actorId: org.ownerId }),
  );
  await asSystem(() => rbac.assignRole(user.id, roleKey, org.ownerId, org.orgId));
  return { userId: user.id, email };
}
