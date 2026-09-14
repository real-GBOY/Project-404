import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { NotFound, Conflict } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { IAuditLogger } from "@core/contracts/index.js";
import { ProjectsRepository, type CreateProjectInput } from "./projects-repository.js";
import { slugify, type CreateProjectBody, type UpdateProjectBody } from "./projects.schema.js";

@Injectable()
export class ProjectsService {
  constructor(
    private readonly repo: ProjectsRepository,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  list() {
    return readInTenant(() => this.repo.list());
  }

  async get(id: string) {
    const project = await readInTenant(() => this.repo.findById(id));
    if (!project) throw NotFound("project.not_found", "Project not found.");
    return project;
  }

  async create(body: CreateProjectBody, actorId: string) {
    const slug = body.slug ? slugify(body.slug) : slugify(body.name);
    const existing = await readInTenant(() => this.repo.findBySlug(slug));
    if (existing) throw Conflict("project.slug_taken", "A project with this slug already exists.");

    const input: CreateProjectInput = { ...body, slug };
    return this.uow.transaction(async () => {
      const created = await this.repo.create(input);
      await this.audit.record({
        actorId,
        action: "realestate.project.created",
        resourceType: "realestate_project",
        resourceId: created.id,
        after: created,
      });
      return created;
    });
  }

  async update(id: string, body: UpdateProjectBody, actorId: string) {
    return this.uow.transaction(async () => {
      const before = await this.repo.findById(id);
      if (!before) throw NotFound("project.not_found", "Project not found.");
      const updated = await this.repo.update(id, body);
      await this.audit.record({
        actorId,
        action: "realestate.project.updated",
        resourceType: "realestate_project",
        resourceId: id,
        before,
        after: updated,
      });
      return updated!;
    });
  }
}
