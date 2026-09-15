import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { UNIT_OF_WORK } from "@core/kernel/tokens.js";
import { ActivitiesRepository, type ActivityFilter, type CreateActivityInput } from "./activities-repository.js";

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly repo: ActivitiesRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  list(filter: ActivityFilter = {}) {
    return readInTenant(() => this.repo.list(filter));
  }

  create(input: CreateActivityInput) {
    return this.uow.transaction(() => this.repo.create(input));
  }
}
