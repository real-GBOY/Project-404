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
import { DashboardService } from "@atlas/realestate/dashboard/dashboard-service.js";

const suite = hasTestDb ? describe : describe.skip;

suite("realestate/dashboard", () => {
  let app: TestingModule;
  let orgA: SeededOrg;
  let orgB: SeededOrg;
  const projects = () => get<ProjectsService>(app, ProjectsService);
  const buildings = () => get<BuildingsService>(app, BuildingsService);
  const units = () => get<UnitsService>(app, UnitsService);
  const dashboard = () => get<DashboardService>(app, DashboardService);

  beforeAll(async () => {
    app = await createRealestateTestApp();
    orgA = await seedOrg(app, "Developer A");
    orgB = await seedOrg(app, "Developer B");
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it("summary() aggregates real project/unit counts", async () => {
    const project = await asUser(orgA.adminId, orgA.orgId, () =>
      projects().create({ name: "Dashboard Project", location: "Cairo", developer: "Dev" }, orgA.adminId),
    );
    const building = await asUser(orgA.adminId, orgA.orgId, () =>
      buildings().create({ projectId: project.id, key: "A", name: "Building A", floors: 2, unitsPerFloor: 3 }, orgA.adminId),
    );
    await asUser(orgA.adminId, orgA.orgId, () => units().generateForBuilding(building.id, orgA.adminId));

    const summary = await asUser(orgA.adminId, orgA.orgId, () => dashboard().summary());
    expect(summary.projectCount).toBeGreaterThanOrEqual(1);
    expect(summary.totalUnits).toBeGreaterThanOrEqual(6);
    expect(summary.leadFunnel).toHaveLength(9);
  });

  it("tenant isolation: developer B's dashboard never reflects developer A's data", async () => {
    const bSummary = await asUser(orgB.adminId, orgB.orgId, () => dashboard().summary());
    expect(bSummary.projectCount).toBe(0);
    expect(bSummary.totalUnits).toBe(0);
  });
});
