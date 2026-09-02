import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { AUDIT_LOGGER, ORGANIZATION_PROVIDER, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import type { IAuditLogger, IOrganizationProvider } from "@core/contracts/index.js";
import { SettingsRepository, type LawFirmSettings } from "./settings-repository.js";

/**
 * Firm settings — one row per organization, created lazily with sane defaults
 * on first read. Consumed by billing (`vatRate`) and the matters form
 * (`matterTypes`, `courts`).
 */
@Injectable()
export class SettingsService {
  constructor(
    private readonly repo: SettingsRepository,
    @Inject(ORGANIZATION_PROVIDER) private readonly orgs: IOrganizationProvider,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async get(): Promise<LawFirmSettings> {
    const existing = await readInTenant(() => this.repo.find());
    if (existing) return existing;
    const org = await this.orgs.getOrganization(requireOrganizationId());
    return this.uow.transaction(() => this.repo.create({ firmName: org?.name ?? "" }));
  }

  async update(patch: Partial<LawFirmSettings>, actorId: string): Promise<LawFirmSettings> {
    await this.get(); // ensure the row exists
    return this.uow.transaction(async () => {
      const before = await this.repo.find();
      const after = await this.repo.update(patch);
      await this.audit.record({
        actorId,
        action: "lawfirm.settings_updated",
        resourceType: "lawfirm_settings",
        resourceId: requireOrganizationId(),
        before,
        after,
      });
      return after;
    });
  }
}
