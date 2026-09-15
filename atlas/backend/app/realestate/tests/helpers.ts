import { Test, type TestingModule } from "@nestjs/testing";
import { AppModule } from "@atlas/app.module.js";
import { AppSeedService } from "@atlas/seed.js";
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

/**
 * Boots the whole Atlas app (`atlas/backend/app/app.module.ts`) for an
 * integration test: resets + migrates Atlas's own schema (via Atlas's own
 * migrate script — see the topology note in that file for why Core's
 * `migrateToLatest` can't be reused here), then runs the layered seed (Core
 * RBAC + real-estate permissions/roles). The outbox worker does not autostart.
 * Mirrors `mizan/backend/app/lawfirm/tests/helpers.ts#createMizanTestApp`.
 */
export async function createRealestateTestApp(
  opts: { clock?: Clock; overrides?: Array<{ token: unknown; value: unknown }> } = {},
): Promise<TestingModule> {
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

  const moduleRef = await builder.compile();
  await moduleRef.init();
  await get<AppSeedService>(moduleRef, AppSeedService).seed();
  return moduleRef;
}

export interface SeededOrg {
  orgId: string;
  adminId: string;
  adminEmail: string;
}

let seq = 0;

/** Register an admin user + create their org + grant `administrator`. */
export async function seedOrg(app: TestingModule, name = "Test Developer"): Promise<SeededOrg> {
  const identity = get<IdentityService>(app, IdentityService);
  const orgs = get<OrganizationService>(app, OrganizationService);
  const rbac = get<RbacService>(app, RbacService);

  const adminEmail = `admin+${Date.now()}-${seq++}@developer.test`;
  const admin = await identity.register({
    email: adminEmail,
    password: "correct horse battery staple",
    displayName: "Org Admin",
  });
  const org = await orgs.createOrganization({ name, createdBy: admin.id });
  await asSystem(() => rbac.assignRole(admin.id, "administrator", admin.id, org.id));
  return { orgId: org.id, adminId: admin.id, adminEmail };
}

/** Register another user, add them to the org, and grant `roleKey`. */
export async function seedAgent(
  app: TestingModule,
  org: SeededOrg,
  roleKey: string,
  displayName = "Agent",
): Promise<string> {
  const identity = get<IdentityService>(app, IdentityService);
  const orgs = get<OrganizationService>(app, OrganizationService);
  const rbac = get<RbacService>(app, RbacService);

  const user = await identity.register({
    email: `agent+${Date.now()}-${seq++}@developer.test`,
    password: "correct horse battery staple",
    displayName,
  });
  await asUser(org.adminId, org.orgId, () =>
    orgs.addMember({ organizationId: org.orgId, userId: user.id, actorId: org.adminId }),
  );
  await asSystem(() => rbac.assignRole(user.id, roleKey, org.adminId, org.orgId));
  return user.id;
}
