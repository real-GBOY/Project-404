import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { NotFound } from "@core/kernel/errors.js";
import { UNIT_OF_WORK } from "@core/kernel/tokens.js";
import { TasksRepository, type CreateTaskInput, type TaskStatus, type TaskFilter } from "../infrastructure/tasks-repository.js";

@Injectable()
export class TasksService {
  constructor(
    private readonly repo: TasksRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  list(filter: TaskFilter = {}) {
    return readInTenant(() => this.repo.list(filter));
  }

  create(input: CreateTaskInput) {
    return this.uow.transaction(() => this.repo.create(input));
  }

  async updateStatus(id: string, status: TaskStatus) {
    return this.uow.transaction(async () => {
      const existing = await this.repo.findById(id);
      if (!existing) throw NotFound("task.not_found", "Task not found.");
      return (await this.repo.updateStatus(id, status))!;
    });
  }
}
