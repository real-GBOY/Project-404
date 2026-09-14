import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { NotFound } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { IAuditLogger } from "@core/contracts/index.js";
import { ProjectsRepository } from "./projects-repository.js";
import { BuildingsRepository, type CreateBuildingInput } from "./buildings-repository.js";
import type { CreateBuildingBody, UpdateBuildingBody } from "./buildings.schema.js";

@Injectable()
export class BuildingsService {
  constructor(
    private readonly repo: BuildingsRepository,
    private readonly projects: ProjectsRepository,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  listForProject(projectId: string) {
    return readInTenant(() => this.repo.listForProject(projectId));
  }

  async get(id: string) {
    const building = await readInTenant(() => this.repo.findById(id));
    if (!building) throw NotFound("building.not_found", "Building not found.");
    return building;
  }

  async create(body: CreateBuildingBody, actorId: string) {
    const input: CreateBuildingInput = body;
    return this.uow.transaction(async () => {
      const project = await this.projects.findById(input.projectId);
      if (!project) throw NotFound("project.not_found", "Project not found.");
      const created = await this.repo.create(input);
      await this.audit.record({
        actorId,
        action: "realestate.building.created",
        resourceType: "realestate_building",
        resourceId: created.id,
        after: created,
      });
      return created;
    });
  }

  async update(id: string, body: UpdateBuildingBody, actorId: string) {
    return this.uow.transaction(async () => {
      const before = await this.repo.findById(id);
      if (!before) throw NotFound("building.not_found", "Building not found.");
      const updated = await this.repo.update(id, body);
      await this.audit.record({
        actorId,
        action: "realestate.building.updated",
        resourceType: "realestate_building",
        resourceId: id,
        before,
        after: updated,
      });
      return updated!;
    });
  }
}
