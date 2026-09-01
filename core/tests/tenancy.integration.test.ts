import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AuricCore } from "../index.js";
import { fixedClock } from "../kernel/clock.js";
import { currentExecutor } from "../kernel/db/db.js";
import { currentOrganizationId } from "../kernel/tenant.js";
import { applyTestConfig, asSystem, asUser, hasTestDb, resetSchema } from "./helpers.js";

/**
 * The row-level-security backstop (§ docs/tenancy.md). The Core runs as
 * `auric_app` (no BYPASSRLS), so these assertions exercise the real policies.
 */
const suite = hasTestDb ? describe : describe.skip;

suite("AURIC Core — multi-tenancy", () => {
  let core: AuricCore;
  const clock = fixedClock("2026-09-01T09:00:00.000Z");

  // Two tenants, each with an owner; userA is also a plain member of orgB.
  let userA: string;
  let userB: string;
  let orgA: string;
  let orgB: string;

  const pw = "correct horse battery";

  beforeAll(async () => {
    applyTestConfig();
    await resetSchema();
    const { createAuricCore } = await import("../index.js");
    core = createAuricCore({ startWorker: false, clock, requireEmailVerification: false });
    await core.migrate();
    await core.seed();

    const id = core.modules.identity.service;
    const orgs = core.modules.organizations.service;
    const rbac = core.modules.rbac.service;

    userA = (await id.register({ email: `a+${Date.now()}@t.test`, password: pw })).id;
    userB = (await id.register({ email: `b+${Date.now()}@t.test`, password: pw })).id;
    orgA = (await orgs.createOrganization({ name: "Org A", createdBy: userA })).id;
    orgB = (await orgs.createOrganization({ name: "Org B", createdBy: userB })).id;

    // A read-only role, and userA joins orgB as a viewer.
    await asUser(userB, orgB, () => rbac.createRole({ key: "viewer", name: "Viewer" }));
    await asUser(userB, orgB, () => rbac.grantPermission("viewer", "read", "role"));
    await asUser(userB, orgB, () => orgs.addMember({ organizationId: orgB, userId: userA, actorId: userB }));
    await asUser(userB, orgB, () => rbac.assignRole(userA, "viewer", userB));
  }, 60_000);

  afterAll(async () => {
    await core?.stop();
  });

  it("cross-tenant leakage: an unscoped query in tenant A never returns tenant B rows", async () => {
    const seen = await asUser(userA, orgA, () =>
      core.uow.transaction(async () => {
        const auditOrgs = await currentExecutor()
          .selectFrom("audit_logs")
          .select("organization_id")
          .execute();
        const roleOrgs = await currentExecutor()
          .selectFrom("user_roles")
          .select("organization_id")
          .execute();
        return { auditOrgs, roleOrgs };
      }),
    );

    expect(seen.auditOrgs.every((r) => r.organization_id === orgA || r.organization_id === null)).toBe(
      true,
    );
    expect(seen.auditOrgs.some((r) => r.organization_id === orgB)).toBe(false);
    // user_roles is strictly scoped — not even NULLs, and definitely not orgB.
    expect(seen.roleOrgs.every((r) => r.organization_id === orgA)).toBe(true);
    expect(seen.roleOrgs.length).toBeGreaterThan(0);
  });

  it("write containment: WITH CHECK rejects a row tagged with another tenant", async () => {
    const adminRole = (await core.modules.rbac.service.listRoles()).find((r) => r.key === "admin")!;
    await expect(
      asUser(userA, orgA, () =>
        core.uow.transaction(() =>
          currentExecutor()
            .insertInto("user_roles")
            .values({ user_id: userA, role_id: adminRole.id, organization_id: orgB })
            .execute(),
        ),
      ),
    ).rejects.toThrow();
  });

  it("missing context: a tenant-scoped use case with no active org throws", () => {
    // requireOrganizationId() throws synchronously, before any DB work.
    expect(() => core.modules.rbac.service.permissionsForUser(userA)).toThrow(/organization/i);
  });

  it("tenant switch: refresh into another org recomputes the perms claim", async () => {
    const jwt = core.modules.identity.jwt;
    const login = await core.modules.identity.service.login({
      email: await userEmail(core, userA),
      password: pw,
      organizationId: orgA,
    });
    expect(login.organizations.map((m) => m.organizationId).sort()).toEqual([orgA, orgB].sort());

    const claimsA = jwt.verifyAccessToken(login.tokens.accessToken);
    expect(claimsA.org).toBe(orgA);
    expect(claimsA.perms).toContain("*:*"); // owner ⇒ admin ⇒ wildcard

    const switched = await core.modules.identity.service.refresh(login.tokens.refreshToken, orgB);
    const claimsB = jwt.verifyAccessToken(switched.accessToken);
    expect(claimsB.org).toBe(orgB);
    expect(claimsB.perms).toEqual(["read:role"]); // viewer in orgB
  }, 30_000);

  it("outbox: a message is dispatched with its origin tenant in context", async () => {
    let captured: string | null | undefined;
    core.registry.onExternal("test.tenant_probe", "test.probe", async () => {
      captured = currentOrganizationId();
    });

    await asUser(userA, orgA, () =>
      core.uow.transaction(() =>
        core.events.publish({ name: "test.tenant_probe", version: 1, payload: {} }),
      ),
    );
    await core.worker.tick();

    expect(captured).toBe(orgA);
  }, 30_000);

  it("system context: the worker drains messages from multiple tenants in one tick", async () => {
    const hits: string[] = [];
    core.registry.onExternal("test.multi_tenant", "test.multi", async () => {
      hits.push(currentOrganizationId() ?? "system");
    });

    await asUser(userA, orgA, () =>
      core.uow.transaction(() => core.events.publish({ name: "test.multi_tenant", version: 1, payload: {} })),
    );
    await asUser(userB, orgB, () =>
      core.uow.transaction(() => core.events.publish({ name: "test.multi_tenant", version: 1, payload: {} })),
    );
    await core.worker.tick();

    expect(hits.sort()).toEqual([orgA, orgB].sort());
  }, 30_000);

  it("system context: signup and org creation need no active tenant", async () => {
    const u = await core.modules.identity.service.register({ email: `sys+${Date.now()}@t.test`, password: pw });
    const o = await asSystem(() =>
      core.modules.organizations.service.createOrganization({ name: "Sys Org", createdBy: u.id }),
    );
    expect(o.id).toMatch(/^org_/);
    // creator is admin there
    expect(await asUser(u.id, o.id, () => core.modules.rbac.permissionProvider.can(u.id, "x", "y"))).toBe(
      true,
    );
  }, 30_000);
});

async function userEmail(core: AuricCore, userId: string): Promise<string> {
  const u = await core.modules.identity.userProvider.getUser(userId);
  return u!.email;
}
