import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { NotFound } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { IAuditLogger } from "@core/contracts/index.js";
import { ApprovalsRepository, type ApprovalStatus, type CreateApprovalInput } from "./approvals-repository.js";

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly repo: ApprovalsRepository,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  list(status?: ApprovalStatus) {
    return readInTenant(() => this.repo.list(status));
  }

  create(input: CreateApprovalInput) {
    return this.uow.transaction(() => this.repo.create(input));
  }

  async decide(id: string, decision: "approved" | "rejected", actorId: string) {
    return this.uow.transaction(async () => {
      const existing = await this.repo.findById(id);
      if (!existing) throw NotFound("approval.not_found", "Approval not found.");
      const updated = await this.repo.decide(id, decision);
      await this.audit.record({
        actorId,
        action: `realestate.approval.${decision}`,
        resourceType: "realestate_approval",
        resourceId: id,
      });
      return updated!;
    });
  }
}
