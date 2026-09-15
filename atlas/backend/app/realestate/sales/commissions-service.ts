import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { NotFound } from "@core/kernel/errors.js";
import { UNIT_OF_WORK } from "@core/kernel/tokens.js";
import { CommissionsRepository, type CommissionFilter, type CommissionStatus, type UpsertCommissionInput } from "./commissions-repository.js";

@Injectable()
export class CommissionsService {
  constructor(
    private readonly repo: CommissionsRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  list(filter: CommissionFilter = {}) {
    return readInTenant(() => this.repo.list(filter));
  }

  upsert(input: UpsertCommissionInput) {
    return this.uow.transaction(() => this.repo.upsert(input));
  }

  async updateStatus(id: string, status: CommissionStatus) {
    return this.uow.transaction(async () => {
      const existing = await this.repo.findById(id);
      if (!existing) throw NotFound("commission.not_found", "Commission not found.");
      return (await this.repo.updateStatus(id, status))!;
    });
  }
}
