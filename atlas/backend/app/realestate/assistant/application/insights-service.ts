import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { UNIT_OF_WORK } from "@core/kernel/tokens.js";
import { InsightsRepository, type InsightKind } from "../infrastructure/insights-repository.js";

@Injectable()
export class InsightsService {
  constructor(
    private readonly repo: InsightsRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  list(kind: InsightKind) {
    return readInTenant(() => this.repo.list(kind));
  }

  dismiss(id: string, userId: string) {
    return this.uow.transaction(() => this.repo.dismiss(id, userId));
  }
}
