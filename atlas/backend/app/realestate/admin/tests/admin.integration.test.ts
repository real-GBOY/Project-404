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
import { AdminService } from "@atlas/realestate/admin/admin-service.js";
import { OrgSettingsService } from "@atlas/realestate/admin/org-settings-service.js";

const suite = hasTestDb ? describe : describe.skip;

suite("realestate/admin", () => {
  let app: TestingModule;
  let orgA: SeededOrg;
  let orgB: SeededOrg;
  const admin = () => get<AdminService>(app, AdminService);
  const settings = () => get<OrgSettingsService>(app, OrgSettingsService);

  beforeAll(async () => {
    app = await createRealestateTestApp();
    orgA = await seedOrg(app, "Developer A");
    orgB = await seedOrg(app, "Developer B");
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it("org settings default and can be updated", async () => {
    const initial = await asUser(orgA.adminId, orgA.orgId, () => settings().get());
    expect(initial.reservationHoldDays).toBe(14);

    const updated = await asUser(orgA.adminId, orgA.orgId, () => settings().update({ reservationHoldDays: 21 }));
    expect(updated.reservationHoldDays).toBe(21);
  });

  it("lists roles filtered to the real-estate role set with permission counts", async () => {
    const result = await asUser(orgA.adminId, orgA.orgId, () => admin().roles());
    const keys = result.items.map((r) => r.key);
    expect(keys).toEqual(
      expect.arrayContaining(["administrator", "commercial_director", "sales_manager", "sales_agent", "finance_controller", "read_only"]),
    );
    expect(result.items.every((r) => r.permissions > 0)).toBe(true);
  });

  it("assignRole replaces (not adds) a member's real-estate role", async () => {
    const agentId = await seedAgent(app, orgA, "sales_agent", "Agent One");
    await asUser(orgA.adminId, orgA.orgId, () => admin().assignRole(agentId, "sales_manager", orgA.adminId));

    const members = await asUser(orgA.adminId, orgA.orgId, () => admin().members());
    const member = members.items.find((m) => m.id === agentId);
    expect(member?.role).toBe("sales_manager");
  });

  it("tenant isolation: org settings and members are scoped per organization", async () => {
    await asUser(orgA.adminId, orgA.orgId, () => settings().update({ reservationHoldDays: 30 }));
    const bSettings = await asUser(orgB.adminId, orgB.orgId, () => settings().get());
    expect(bSettings.reservationHoldDays).toBe(14); // unaffected by org A's change

    const bMembers = await asUser(orgB.adminId, orgB.orgId, () => admin().members());
    expect(bMembers.items.some((m) => m.id === orgA.adminId)).toBe(false);
  });
});
