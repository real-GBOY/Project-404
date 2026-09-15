import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TestingModule } from "@nestjs/testing";
import {
  asUser,
  createRealestateTestApp,
  get,
  hasTestDb,
  seedAgent,
  seedOrg,
  type SeededOrg,
} from "@atlas/realestate/tests/helpers.js";
import { PERMISSION_PROVIDER } from "@core/kernel/tokens.js";
import type { IPermissionProvider } from "@core/contracts/index.js";
import { ProjectsService } from "@atlas/realestate/properties/projects-service.js";

const suite = hasTestDb ? describe : describe.skip;

suite("realestate/properties/projects", () => {
  let app: TestingModule;
  let orgA: SeededOrg;
  let orgB: SeededOrg;
  const svc = () => get<ProjectsService>(app, ProjectsService);

  beforeAll(async () => {
    app = await createRealestateTestApp();
    orgA = await seedOrg(app, "Developer A");
    orgB = await seedOrg(app, "Developer B");
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it("creates a project and reads it back, slugified from the name", async () => {
    const created = await asUser(orgA.adminId, orgA.orgId, () =>
      svc().create(
        { name: "North Hills", location: "New Cairo", developer: "Developer A", status: "launched" },
        orgA.adminId,
      ),
    );
    expect(created.id).toMatch(/^prj_/);
    expect(created.slug).toBe("north-hills");
    expect(created.totalUnits).toBe(0);

    const fetched = await asUser(orgA.adminId, orgA.orgId, () => svc().get(created.id));
    expect(fetched.name).toBe("North Hills");
  });

  it("rejects a duplicate slug within the same org", async () => {
    await asUser(orgA.adminId, orgA.orgId, () =>
      svc().create({ name: "Cedar Residences", location: "6 October", developer: "Developer A" }, orgA.adminId),
    );
    await expect(
      asUser(orgA.adminId, orgA.orgId, () =>
        svc().create({ name: "Cedar Residences", location: "Elsewhere", developer: "Developer A" }, orgA.adminId),
      ),
    ).rejects.toThrow(/already exists/i);
  });

  it("updates a project's status", async () => {
    const created = await asUser(orgA.adminId, orgA.orgId, () =>
      svc().create({ name: "Palm District", location: "Sheikh Zayed", developer: "Developer A" }, orgA.adminId),
    );
    const updated = await asUser(orgA.adminId, orgA.orgId, () =>
      svc().update(created.id, { status: "delivered" }, orgA.adminId),
    );
    expect(updated.status).toBe("delivered");
  });

  it("authz: the seeded role matrix gates create:project but allows read:project for read_only", async () => {
    const readerId = await seedAgent(app, orgA, "read_only", "Reader");
    const perms = get<IPermissionProvider>(app, PERMISSION_PROVIDER);
    const can = (uid: string, action: string, resource: string) =>
      asUser(uid, orgA.orgId, () => perms.can(uid, action, resource));

    expect(await can(readerId, "read", "project")).toBe(true);
    expect(await can(readerId, "create", "project")).toBe(false);
    expect(await can(orgA.adminId, "create", "project")).toBe(true);
  });

  it("tenant isolation: developer B cannot see or fetch developer A's projects", async () => {
    const a = await asUser(orgA.adminId, orgA.orgId, () =>
      svc().create({ name: "A-only", location: "Nowhere", developer: "Developer A" }, orgA.adminId),
    );
    const bList = await asUser(orgB.adminId, orgB.orgId, () => svc().list());
    expect(bList.some((p) => p.id === a.id)).toBe(false);
    await expect(asUser(orgB.adminId, orgB.orgId, () => svc().get(a.id))).rejects.toThrow(/not found/i);
  });
});
