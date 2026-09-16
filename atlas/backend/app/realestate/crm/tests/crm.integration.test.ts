import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TestingModule } from "@nestjs/testing";
import {
  asUser,
  createRealestateTestApp,
  get,
  hasTestDb,
  seedOrg,
  type SeededOrg,
} from "@atlas/realestate/tests/helpers.js";
import { LeadsService } from "@atlas/realestate/crm/application/leads-service.js";
import { CustomersService } from "@atlas/realestate/crm/application/customers-service.js";

const suite = hasTestDb ? describe : describe.skip;

suite("realestate/crm", () => {
  let app: TestingModule;
  let orgA: SeededOrg;
  let orgB: SeededOrg;
  const leads = () => get<LeadsService>(app, LeadsService);
  const customers = () => get<CustomersService>(app, CustomersService);

  beforeAll(async () => {
    app = await createRealestateTestApp();
    orgA = await seedOrg(app, "Developer A");
    orgB = await seedOrg(app, "Developer B");
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it("creates a lead defaulted to stage=new, then moves its stage independent of status", async () => {
    const created = await asUser(orgA.adminId, orgA.orgId, () =>
      leads().create(
        { name: "Tarek ElGohary", phone: "+201000000000", source: "referral", agentId: orgA.adminId },
        orgA.adminId,
      ),
    );
    expect(created.stage).toBe("new");

    const moved = await asUser(orgA.adminId, orgA.orgId, () =>
      leads().moveStage(created.id, "reserved", orgA.adminId),
    );
    expect(moved.stage).toBe("reserved");
    expect(moved.status).toBe("new"); // untouched by a pure pipeline drag
  });

  it("trackAsDeal sets probability/expectedClose, which is what makes it appear on the Deals screen", async () => {
    const lead = await asUser(orgA.adminId, orgA.orgId, () =>
      leads().create({ name: "Mona Fahmy", phone: "+201000000001", source: "website", agentId: orgA.adminId }, orgA.adminId),
    );
    const asDeal = await asUser(orgA.adminId, orgA.orgId, () =>
      leads().trackAsDeal(lead.id, { probabilityPct: 60, expectedCloseDate: "2026-12-01" }, orgA.adminId),
    );
    expect(asDeal.probabilityPct).not.toBeNull();

    const deals = await asUser(orgA.adminId, orgA.orgId, () => leads().list({ dealsOnly: true }));
    expect(deals.some((d) => d.id === lead.id)).toBe(true);
  });

  it("creates a customer and reports their owned units", async () => {
    const customer = await asUser(orgA.adminId, orgA.orgId, () =>
      customers().create({ name: "Karim Abdelrahman", agentId: orgA.adminId }, orgA.adminId),
    );
    const fetched = await asUser(orgA.adminId, orgA.orgId, () => customers().get(customer.id));
    expect(fetched.unitsOwned).toEqual([]);
  });

  it("tenant isolation: developer B cannot see developer A's leads or customers", async () => {
    const lead = await asUser(orgA.adminId, orgA.orgId, () =>
      leads().create({ name: "A-only", phone: "+201000000002", source: "broker", agentId: orgA.adminId }, orgA.adminId),
    );
    const customer = await asUser(orgA.adminId, orgA.orgId, () =>
      customers().create({ name: "A-only Customer", agentId: orgA.adminId }, orgA.adminId),
    );

    const bLeads = await asUser(orgB.adminId, orgB.orgId, () => leads().list({}));
    expect(bLeads.some((l) => l.id === lead.id)).toBe(false);
    await expect(asUser(orgB.adminId, orgB.orgId, () => leads().get(lead.id))).rejects.toThrow(/not found/i);

    const bCustomers = await asUser(orgB.adminId, orgB.orgId, () => customers().list());
    expect(bCustomers.some((c) => c.id === customer.id)).toBe(false);
    await expect(asUser(orgB.adminId, orgB.orgId, () => customers().get(customer.id))).rejects.toThrow(/not found/i);
  });
});
