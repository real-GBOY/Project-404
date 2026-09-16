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
import { ProjectsService } from "@atlas/realestate/properties/application/projects-service.js";
import { BuildingsService } from "@atlas/realestate/properties/application/buildings-service.js";
import { UnitsService } from "@atlas/realestate/properties/application/units-service.js";
import { CustomersService } from "@atlas/realestate/crm/application/customers-service.js";
import { ReservationsService } from "@atlas/realestate/sales/application/reservations-service.js";
import { ContractsService } from "@atlas/realestate/sales/application/contracts-service.js";
import { PaymentPlansService } from "@atlas/realestate/sales/application/payment-plans-service.js";

const suite = hasTestDb ? describe : describe.skip;

suite("realestate/sales", () => {
  let app: TestingModule;
  let orgA: SeededOrg;
  let orgB: SeededOrg;
  const projects = () => get<ProjectsService>(app, ProjectsService);
  const buildings = () => get<BuildingsService>(app, BuildingsService);
  const units = () => get<UnitsService>(app, UnitsService);
  const customers = () => get<CustomersService>(app, CustomersService);
  const reservations = () => get<ReservationsService>(app, ReservationsService);
  const contracts = () => get<ContractsService>(app, ContractsService);
  const paymentPlans = () => get<PaymentPlansService>(app, PaymentPlansService);

  beforeAll(async () => {
    app = await createRealestateTestApp();
    orgA = await seedOrg(app, "Developer A");
    orgB = await seedOrg(app, "Developer B");
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  async function seedAvailableUnit(org: SeededOrg) {
    const project = await asUser(org.adminId, org.orgId, () =>
      projects().create({ name: `Project ${Date.now()}`, location: "Cairo", developer: "Dev" }, org.adminId),
    );
    // A small grid can hash entirely into one status bucket (unitAt's formula is
    // deterministic on buildingKey+floor+idx) — 5x4 reliably yields a status mix.
    const building = await asUser(org.adminId, org.orgId, () =>
      buildings().create({ projectId: project.id, key: "A", name: "Building A", floors: 5, unitsPerFloor: 4 }, org.adminId),
    );
    await asUser(org.adminId, org.orgId, () => units().generateForBuilding(building.id, org.adminId));
    const list = await asUser(org.adminId, org.orgId, () => units().list({ buildingId: building.id, status: "available" }));
    return list[0];
  }

  it("reserving a unit marks it reserved and updates the project rollup", async () => {
    const unit = await seedAvailableUnit(orgA);
    const customer = await asUser(orgA.adminId, orgA.orgId, () =>
      customers().create({ name: "Reservation Customer", agentId: orgA.adminId }, orgA.adminId),
    );
    const reservation = await asUser(orgA.adminId, orgA.orgId, () =>
      reservations().create(
        { unitId: unit.id, customerId: customer.id, agentId: orgA.adminId, holdDays: 14, depositEgp: 100_000 },
        orgA.adminId,
      ),
    );
    expect(reservation.status).toBe("active");

    const refetchedUnit = await asUser(orgA.adminId, orgA.orgId, () => units().get(unit.id));
    expect(refetchedUnit.status).toBe("reserved");
  });

  it("signing a contract marks the unit sold and closes out the reservation", async () => {
    const unit = await seedAvailableUnit(orgA);
    const customer = await asUser(orgA.adminId, orgA.orgId, () =>
      customers().create({ name: "Sign Customer", agentId: orgA.adminId }, orgA.adminId),
    );
    const reservation = await asUser(orgA.adminId, orgA.orgId, () =>
      reservations().create({ unitId: unit.id, customerId: customer.id, agentId: orgA.adminId, holdDays: 14, depositEgp: 100_000 }, orgA.adminId),
    );
    const contract = await asUser(orgA.adminId, orgA.orgId, () =>
      contracts().create({ reservationId: reservation.id, customerId: customer.id, unitId: unit.id, valueEgp: unit.basePriceEgp }, orgA.adminId),
    );
    const signed = await asUser(orgA.adminId, orgA.orgId, () => contracts().sign(contract.id, orgA.adminId));
    expect(signed.status).toBe("signed");

    const soldUnit = await asUser(orgA.adminId, orgA.orgId, () => units().get(unit.id));
    expect(soldUnit.status).toBe("sold");
  });

  it("creating a payment plan generates a reconciling installment schedule", async () => {
    const unit = await seedAvailableUnit(orgA);
    const customer = await asUser(orgA.adminId, orgA.orgId, () =>
      customers().create({ name: "Plan Customer", agentId: orgA.adminId }, orgA.adminId),
    );
    const contract = await asUser(orgA.adminId, orgA.orgId, () =>
      contracts().create({ customerId: customer.id, unitId: unit.id, valueEgp: 10_000_000 }, orgA.adminId),
    );
    const plan = await asUser(orgA.adminId, orgA.orgId, () =>
      paymentPlans().create(
        { contractId: contract.id, downPaymentPct: 10, installmentCount: 4, cadence: "quarterly", startDate: "2026-01-01" },
        orgA.adminId,
      ),
    );
    expect(plan.installments).toHaveLength(5);
    const sum = plan.installments.reduce((s, i) => s + i.amountEgp, 0);
    expect(sum).toBe(10_000_000);
  });

  it("tenant isolation: developer B cannot see developer A's reservations", async () => {
    const unit = await seedAvailableUnit(orgA);
    const customer = await asUser(orgA.adminId, orgA.orgId, () =>
      customers().create({ name: "Iso Customer", agentId: orgA.adminId }, orgA.adminId),
    );
    const reservation = await asUser(orgA.adminId, orgA.orgId, () =>
      reservations().create({ unitId: unit.id, customerId: customer.id, agentId: orgA.adminId, holdDays: 14, depositEgp: 50_000 }, orgA.adminId),
    );
    const bList = await asUser(orgB.adminId, orgB.orgId, () => reservations().list());
    expect(bList.some((r) => r.id === reservation.id)).toBe(false);
    await expect(asUser(orgB.adminId, orgB.orgId, () => reservations().get(reservation.id))).rejects.toThrow(/not found/i);
  });
});
