import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { UNIT_OF_WORK } from "@core/kernel/tokens.js";
import { OrgSettingsRepository } from "../infrastructure/org-settings-repository.js";
import type { UpdateOrgSettingsBody } from "../validation/admin.schema.js";

@Injectable()
export class OrgSettingsService {
  constructor(
    private readonly repo: OrgSettingsRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  get() {
    return readInTenant(() => this.repo.get());
  }

  update(patch: UpdateOrgSettingsBody) {
    return this.uow.transaction(() => this.repo.update(patch));
  }
}
