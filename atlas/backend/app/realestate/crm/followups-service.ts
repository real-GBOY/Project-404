import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { NotFound } from "@core/kernel/errors.js";
import { UNIT_OF_WORK } from "@core/kernel/tokens.js";
import { FollowupsRepository, type CreateFollowupInput, type FollowupFilter, type FollowupStatus } from "./followups-repository.js";

@Injectable()
export class FollowupsService {
  constructor(
    private readonly repo: FollowupsRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  list(filter: FollowupFilter = {}) {
    return readInTenant(() => this.repo.list(filter));
  }

  create(input: CreateFollowupInput) {
    return this.uow.transaction(() => this.repo.create(input));
  }

  async updateStatus(id: string, status: FollowupStatus) {
    return this.uow.transaction(async () => {
      const existing = await this.repo.findById(id);
      if (!existing) throw NotFound("followup.not_found", "Followup not found.");
      return (await this.repo.updateStatus(id, status))!;
    });
  }
}
