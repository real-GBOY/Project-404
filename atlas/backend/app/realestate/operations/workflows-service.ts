import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { NotFound } from "@core/kernel/errors.js";
import { UNIT_OF_WORK } from "@core/kernel/tokens.js";
import { WorkflowsRepository, type CreateWorkflowInput } from "./workflows-repository.js";

@Injectable()
export class WorkflowsService {
  constructor(
    private readonly repo: WorkflowsRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async list() {
    return readInTenant(async () => {
      const workflows = await this.repo.list();
      return Promise.all(
        workflows.map(async (w) => ({ ...w, steps: await this.repo.steps(w.id) })),
      );
    });
  }

  create(input: CreateWorkflowInput) {
    return this.uow.transaction(() => this.repo.create(input));
  }

  async advance(workflowId: string, seqNo: number) {
    return this.uow.transaction(async () => {
      const workflow = await this.repo.findById(workflowId);
      if (!workflow) throw NotFound("workflow.not_found", "Workflow not found.");
      await this.repo.advanceStep(workflowId, seqNo);
      return { ...workflow, steps: await this.repo.steps(workflowId) };
    });
  }
}
