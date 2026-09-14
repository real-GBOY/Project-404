import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { UNIT_OF_WORK } from "@core/kernel/tokens.js";
import { FinancialReportsRepository, type CreateFinancialReportInput } from "./financial-reports-repository.js";

@Injectable()
export class FinancialReportsService {
  constructor(
    private readonly repo: FinancialReportsRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  list() {
    return readInTenant(() => this.repo.list());
  }

  create(input: CreateFinancialReportInput) {
    return this.uow.transaction(() => this.repo.create(input));
  }
}
