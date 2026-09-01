import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TestingModule } from "@nestjs/testing";
import { fixedClock } from "../kernel/clock.js";
import { currentExecutor, unitOfWork } from "../kernel/db/db.js";
import { currentOrganizationId } from "../kernel/tenant.js";
import { EVENT_BUS, JWT_SERVICE, USER_PROVIDER } from "../kernel/tokens.js";
import type { IEventBus, IUserProvider } from "../contracts/index.js";
import { EventRegistry } from "../events/registry.js";
import { OutboxWorker } from "../events/outbox/outbox-worker.js";
import { IdentityService } from "../identity/application/identity-service.js";
import type { JwtService } from "../identity/infrastructure/jwt-service.js";
import { RbacService } from "../rbac/application/rbac-service.js";
import { RbacPermissionProvider } from "../rbac/infrastructure/permission-provider.js";
import { OrganizationService } from "../organizations/application/organization-service.js";
import { asSystem, asUser, createTestCore, get, hasTestDb } from "./helpers.js";

/**
 * The row-level-security backstop (§ docs/tenancy.md). The Core runs as
 * `auric_app` (no BYPASSRLS), so these assertions exercise the real policies.
 */
const suite = hasTestDb ? describe : describe.skip;

suite("AURIC Core — multi-tenancy", () => {
  let core: TestingModule;
  const clock = fixedClock("2026-09-01T09:00:00.000Z");

  // Two tenants, each with an owner; userA is also a plain member of orgB.
  let userA: string;
  let userB: string;
  let orgA: string;
  let orgB: string;

  const pw = "correct horse battery";
  const id = () => get(core, IdentityService);
  const orgs = () => get(core, OrganizationService);
  const rbac = () => get(core, RbacService);

  beforeAll(async () => {
    core = await createTestCore({ clock, requireEmailVerification: false });

    userA = (await id().register({ email: `a+${Date.now()}@t.test`, password: pw })).id;
    userB = (await id().register({ email: `b+${Date.now()}@t.test`, password: pw })).id;
    orgA = (await orgs().createOrganization({ name: "Org A", createdBy: userA })).id;
    orgB = (await orgs().createOrganization({ name: "Org B", createdBy: userB })).id;

    await asUser(userB, orgB, () => rbac().createRole({ key: "viewer", name: "Viewer" }));
    await asUser(userB, orgB, () => rbac().grantPermission("viewer", "read", "role"));
    await asUser(userB, orgB, () =>
      orgs().addMember({ organizationId: orgB, userId: userA, actorId: userB }),
    );
    await asUser(userB, orgB, () => rbac().assignRole(userA, "viewer", userB));
  }, 60_000);

  afterAll(async () => {
    await core?.close();
  });

  it("cross-tenant leakage: an unscoped query in tenant A never returns tenant B rows", async () => {
    const seen = await asUser(userA, orgA, () =>
      unitOfWork.transaction(async () => ({
        auditOrgs: await currentExecutor().selectFrom("audit_logs").select("organization_id").execute(),
        roleOrgs: await currentExecutor().selectFrom("user_roles").select("organization_id").execute(),
      })),
    );

    expect(seen.auditOrgs.every((r) => r.organization_id === orgA || r.organization_id === null)).toBe(
      true,
    );
    expect(seen.auditOrgs.some((r) => r.organization_id === orgB)).toBe(false);
    expect(seen.roleOrgs.every((r) => r.organization_id === orgA)).toBe(true);
    expect(seen.roleOrgs.length).toBeGreaterThan(0);
  });

  it("write containment: WITH CHECK rejects a row tagged with another tenant", async () => {
    const adminRole = (await rbac().listRoles()).find((r) => r.key === "admin")!;
    await expect(
      asUser(userA, orgA, () =>
        unitOfWork.transaction(() =>
          currentExecutor()
            .insertInto("user_roles")
            .values({ user_id: userA, role_id: adminRole.id, organization_id: orgB })
            .execute(),
        ),
      ),
    ).rejects.toThrow();
  });

  it("missing context: a tenant-scoped use case with no active org throws", () => {
    expect(() => rbac().permissionsForUser(userA)).toThrow(/organization/i);
  });

  it("tenant switch: refresh into another org recomputes the perms claim", async () => {
    const jwt = get<JwtService>(core, JWT_SERVICE);
    const email = (await get<IUserProvider>(core, USER_PROVIDER).getUser(userA))!.email;
    const login = await id().login({ email, password: pw, organizationId: orgA });
    expect(login.organizations.map((m) => m.organizationId).sort()).toEqual([orgA, orgB].sort());

    const claimsA = jwt.verifyAccessToken(login.tokens.accessToken);
    expect(claimsA.org).toBe(orgA);
    expect(claimsA.perms).toContain("*:*");

    const switched = await id().refresh(login.tokens.refreshToken, orgB);
    const claimsB = jwt.verifyAccessToken(switched.accessToken);
    expect(claimsB.org).toBe(orgB);
    expect(claimsB.perms).toEqual(["read:role"]);
  }, 30_000);

  it("outbox: a message is dispatched with its origin tenant in context", async () => {
    let captured: string | null | undefined;
    get(core, EventRegistry).onExternal("test.tenant_probe", "test.probe", async () => {
      captured = currentOrganizationId();
    });

    await asUser(userA, orgA, () =>
      unitOfWork.transaction(() =>
        get<IEventBus>(core, EVENT_BUS).publish({ name: "test.tenant_probe", version: 1, payload: {} }),
      ),
    );
    await get(core, OutboxWorker).tick();
    expect(captured).toBe(orgA);
  }, 30_000);

  it("system context: the worker drains messages from multiple tenants in one tick", async () => {
    const hits: string[] = [];
    get(core, EventRegistry).onExternal("test.multi_tenant", "test.multi", async () => {
      hits.push(currentOrganizationId() ?? "system");
    });

    await asUser(userA, orgA, () =>
      unitOfWork.transaction(() =>
        get<IEventBus>(core, EVENT_BUS).publish({ name: "test.multi_tenant", version: 1, payload: {} }),
      ),
    );
    await asUser(userB, orgB, () =>
      unitOfWork.transaction(() =>
        get<IEventBus>(core, EVENT_BUS).publish({ name: "test.multi_tenant", version: 1, payload: {} }),
      ),
    );
    await get(core, OutboxWorker).tick();
    expect(hits.sort()).toEqual([orgA, orgB].sort());
  }, 30_000);

  it("system context: signup and org creation need no active tenant", async () => {
    const u = await id().register({ email: `sys+${Date.now()}@t.test`, password: pw });
    const o = await asSystem(() => orgs().createOrganization({ name: "Sys Org", createdBy: u.id }));
    expect(o.id).toMatch(/^org_/);
    expect(
      await asUser(u.id, o.id, () => get(core, RbacPermissionProvider).can(u.id, "x", "y")),
    ).toBe(true);
  }, 30_000);
});
