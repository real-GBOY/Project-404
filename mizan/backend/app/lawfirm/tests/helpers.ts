import { Test, type TestingModule } from "@nestjs/testing";
import { AppModule } from "../../app.module.js";
import { AppSeedService } from "../../seed.js";
import { migrateToLatest } from "../../../../../core/kernel/db/migrate.js";
import { CLOCK, REQUIRE_EMAIL_VERIFICATION, WORKER_AUTOSTART } from "../../../../../core/kernel/tokens.js";
import type { Clock } from "../../../../../core/kernel/clock.js";
import {
  applyTestConfig,
  asSystem,
  asUser,
  get,
  hasTestDb,
  resetSchema,
  TEST_DATABASE_URL,
} from "../../../../../core/tests/helpers.js";
import { IdentityService } from "../../../../../core/identity/application/identity-service.js";
import { OrganizationService } from "../../../../../core/organizations/application/organization-service.js";
import { RbacService } from "../../../../../core/rbac/application/rbac-service.js";

export { asSystem, asUser, get, hasTestDb };

/**
 * Boots the whole Mizan app (`mizan/backend/app/app.module.ts`) for an
 * integration test: resets + migrates the schema, compiles as `auric_app`,
 * then runs the layered seed (Core RBAC + law-firm permissions/roles).
 * The outbox worker does not autostart.
 */
export async function createMizanTestApp(opts: { clock?: Clock } = {}): Promise<TestingModule> {
  applyTestConfig();
  await resetSchema();
  await migrateToLatest(TEST_DATABASE_URL);

  const builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(WORKER_AUTOSTART)
    .useValue(false)
    .overrideProvider(REQUIRE_EMAIL_VERIFICATION)
    .useValue(false);
  if (opts.clock) builder.overrideProvider(CLOCK).useValue(opts.clock);

  const moduleRef = await builder.compile();
  await moduleRef.init();
  await get<AppSeedService>(moduleRef, AppSeedService).seed();
  return moduleRef;
}

export interface SeededFirm {
  orgId: string;
  adminId: string;
  adminEmail: string;
}

let seq = 0;

/** Register an admin user + create their firm + grant `firm_admin`. */
export async function seedFirm(app: TestingModule, name = "Test Firm"): Promise<SeededFirm> {
  const identity = get<IdentityService>(app, IdentityService);
  const orgs = get<OrganizationService>(app, OrganizationService);
  const rbac = get<RbacService>(app, RbacService);

  const adminEmail = `admin+${Date.now()}-${seq++}@firm.test`;
  const admin = await identity.register({ email: adminEmail, password: "correct horse battery staple", displayName: "Firm Admin" });
  const org = await orgs.createOrganization({ name, createdBy: admin.id });
  await asSystem(() => rbac.assignRole(admin.id, "firm_admin", admin.id, org.id));
  return { orgId: org.id, adminId: admin.id, adminEmail };
}

/** Register another user, add them to the firm, and grant `roleKey`. */
export async function seedMember(
  app: TestingModule,
  firm: SeededFirm,
  roleKey: string,
  displayName = "Team Member",
): Promise<string> {
  const identity = get<IdentityService>(app, IdentityService);
  const orgs = get<OrganizationService>(app, OrganizationService);
  const rbac = get<RbacService>(app, RbacService);

  const user = await identity.register({
    email: `member+${Date.now()}-${seq++}@firm.test`,
    password: "correct horse battery staple",
    displayName,
  });
  await asUser(firm.adminId, firm.orgId, () =>
    orgs.addMember({ organizationId: firm.orgId, userId: user.id, actorId: firm.adminId }),
  );
  await asSystem(() => rbac.assignRole(user.id, roleKey, firm.adminId, firm.orgId));
  return user.id;
}
