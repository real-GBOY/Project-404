import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { ValidationError } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, CLOCK, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IAuditLogger } from "@core/contracts/index.js";
import { localDate, type IsoDate } from "@raqib/raqib/shared/dates.js";
import { pinnedBusinessDate } from "@raqib/raqib/shared/business-date.js";
import { diffSettings, type OrgSettings } from "../domain/defaults.js";
import { SettingsRepository } from "../infrastructure/settings-repository.js";

@Injectable()
export class SettingsService {
  constructor(
    private readonly repo: SettingsRepository,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  current(): Promise<OrgSettings> {
    return readInTenant(() => this.repo.load());
  }

  /** The organization's business date: pinned (demo history / tests) or "now" in its time zone. */
  async today(): Promise<IsoDate> {
    const pinned = pinnedBusinessDate();
    if (pinned) return pinned;
    const s = await this.current();
    return localDate(this.clock.now(), s.org.tz);
  }

  async update(next: OrgSettings, reason: string, actorId: string): Promise<OrgSettings> {
    if (next.scoring.mid >= next.scoring.high) {
      throw ValidationError("settings.invalid_thresholds", "The moderate threshold must be below the high threshold.");
    }
    return this.uow.transaction(async () => {
      const before = await this.repo.load();
      const changed = diffSettings(before, next);
      if (!changed.length) return before;
      await this.repo.save(next, actorId);
      await this.audit.record({
        actorId,
        action: "raqib.settings.changed",
        resourceType: "raqib_settings",
        resourceId: "settings",
        metadata: { changed, reason },
      });
      return next;
    });
  }
}
