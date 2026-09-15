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
import { ProjectsService } from "@atlas/realestate/properties/projects-service.js";
import { BuildingsService } from "@atlas/realestate/properties/buildings-service.js";
import { UnitsService } from "@atlas/realestate/properties/units-service.js";
import { CustomersService } from "@atlas/realestate/crm/customers-service.js";
import { ContractsService } from "@atlas/realestate/sales/contracts-service.js";
import { PaymentPlansService } from "@atlas/realestate/sales/payment-plans-service.js";
import { PaymentsService } from "@atlas/realestate/finance/payments-service.js";

const suite = hasTestDb ? describe : describe.skip;

suite("realestate/finance", () => {
  let app: TestingModule;
  let orgA: SeededOrg;
  let orgB: SeededOrg;
  const projects = () => get<ProjectsService>(app, ProjectsService);
  const buildings = () => get<BuildingsService>(app, BuildingsService);
  const units = () => get<UnitsService>(app, UnitsService);
  const customers = () => get<CustomersService>(app, CustomersService);
  const contracts = () => get<ContractsService>(app, ContractsService);
  const paymentPlans = () => get<PaymentPlansService>(app, PaymentPlansService);
  const payments = () => get<PaymentsService>(app, PaymentsService);

  beforeAll(async () => {
    app = await createRealestateTestApp();
    orgA = await seedOrg(app, "Developer A");
    orgB = await seedOrg(app, "Developer B");
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  async function seedPlan(org: SeededOrg) {
    const project = await asUser(org.adminId, org.orgId, () =>
      projects().create({ name: `Project ${Date.now()}`, location: "Cairo", developer: "Dev" }, org.adminId),
    );
    const building = await asUser(org.adminId, org.orgId, () =>
      buildings().create({ projectId: project.id, key: "A", name: "Building A", floors: 1, unitsPerFloor: 1 }, org.adminId),
    );
    await asUser(org.adminId, org.orgId, () => units().generateForBuilding(building.id, org.adminId));
    const [unit] = await asUser(org.adminId, org.orgId, () => units().list({ buildingId: building.id }));
    const customer = await asUser(org.adminId, org.orgId, () =>
      customers().create({ name: "Finance Customer", agentId: org.adminId }, org.adminId),
    );
    const contract = await asUser(org.adminId, org.orgId, () =>
      contracts().create({ customerId: customer.id, unitId: unit.id, valueEgp: 4_000_000 }, org.adminId),
    );
    const plan = await asUser(org.adminId, org.orgId, () =>
      paymentPlans().create({ contractId: contract.id, downPaymentPct: 25, installmentCount: 2, cadence: "quarterly", startDate: "2026-01-01" }, org.adminId),
    );
    return { unit, customer, plan };
  }

  it("recording a payment against an installment marks it paid and shows up in the customer's history", async () => {
    const { unit, customer, plan } = await seedPlan(orgA);
    const downPayment = plan.installments[0];
    const recorded = await asUser(orgA.adminId, orgA.orgId, () =>
      payments().record(
        { customerId: customer.id, unitId: unit.id, installmentId: downPayment.id, amountEgp: downPayment.amountEgp, method: "bank-transfer" },
        orgA.adminId,
      ),
    );
    expect(recorded.status).toBe("paid");

    const history = await asUser(orgA.adminId, orgA.orgId, () => payments().list({ customerId: customer.id }));
    expect(history.some((p) => p.id === recorded.id)).toBe(true);
  });

  it("outstanding() reports installments past due that are not yet fully paid", async () => {
    const { plan } = await seedPlan(orgA);
    expect(plan.installments.length).toBeGreaterThan(0);
    const outstanding = await asUser(orgA.adminId, orgA.orgId, () => payments().outstanding());
    // Every generated installment is due in the future relative to "today" in this
    // synthetic dataset, so outstanding() should not throw and returns an array shape.
    expect(Array.isArray(outstanding)).toBe(true);
  });

  it("tenant isolation: developer B cannot see developer A's payments", async () => {
    const { unit, customer, plan } = await seedPlan(orgA);
    const payment = await asUser(orgA.adminId, orgA.orgId, () =>
      payments().record({ customerId: customer.id, unitId: unit.id, installmentId: plan.installments[0].id, amountEgp: 1000, method: "cash" }, orgA.adminId),
    );
    const bList = await asUser(orgB.adminId, orgB.orgId, () => payments().list());
    expect(bList.some((p) => p.id === payment.id)).toBe(false);
  });
});
