import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { NotFound } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { IAuditLogger } from "@core/contracts/index.js";
import { BuildingsRepository } from "./buildings-repository.js";
import { ProjectsRepository } from "./projects-repository.js";
import { UnitsRepository, type UnitFilter } from "./units-repository.js";
import { generateUnitsForBuilding } from "./unit.domain.js";
import type { UpdateUnitStatusBody } from "./units.schema.js";

@Injectable()
export class UnitsService {
  constructor(
    private readonly repo: UnitsRepository,
    private readonly buildings: BuildingsRepository,
    private readonly projects: ProjectsRepository,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  list(filter: UnitFilter) {
    return readInTenant(() => this.repo.list(filter));
  }

  async get(id: string) {
    const unit = await readInTenant(() => this.repo.findById(id));
    if (!unit) throw NotFound("unit.not_found", "Unit not found.");
    return unit;
  }

  availability() {
    return readInTenant(() => this.repo.availabilitySummary());
  }

  /** Materializes a building's floor-plate using the same deterministic formula the frontend mock uses. */
  async generateForBuilding(buildingId: string, actorId: string) {
    return this.uow.transaction(async () => {
      const building = await this.buildings.findById(buildingId);
      if (!building) throw NotFound("building.not_found", "Building not found.");

      const generated = generateUnitsForBuilding(building.key, building.floors, building.unitsPerFloor);
      await this.repo.bulkInsert(
        generated.map((u) => ({
          buildingId: building.id,
          projectId: building.projectId,
          code: u.code,
          floor: u.floor,
          unitType: u.unitType,
          areaSqm: u.areaSqm,
          basePriceEgp: u.basePriceEgp,
          status: u.status,
        })),
      );
      await this.projects.refreshRollups(building.projectId);
      await this.audit.record({
        actorId,
        action: "realestate.units.generated",
        resourceType: "realestate_building",
        resourceId: building.id,
        after: { count: generated.length },
      });
      return { count: generated.length };
    });
  }

  async updateStatus(id: string, body: UpdateUnitStatusBody, actorId: string) {
    return this.uow.transaction(async () => {
      const before = await this.repo.findById(id);
      if (!before) throw NotFound("unit.not_found", "Unit not found.");
      const updated = await this.repo.updateStatus(id, body.status, {
        customerId: body.customerId,
        agentId: body.agentId,
      });
      await this.projects.refreshRollups(before.projectId);
      await this.audit.record({
        actorId,
        action: "realestate.unit.status_changed",
        resourceType: "realestate_unit",
        resourceId: id,
        before: { status: before.status },
        after: { status: updated!.status },
      });
      return updated!;
    });
  }
}
