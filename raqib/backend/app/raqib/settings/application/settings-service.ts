import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { Conflict, ValidationError } from "@core/kernel/errors.js";
import { raqibDb } from "@raqib/raqib/db/executor.js";
import { AUDIT_LOGGER, CLOCK, FILE_STORAGE, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IAuditLogger, IFileStorage } from "@core/contracts/index.js";
import { localDate, type IsoDate } from "@raqib/raqib/shared/dates.js";
import { pinnedBusinessDate } from "@raqib/raqib/shared/business-date.js";
import { diffSettings, type OrgSettings } from "../domain/defaults.js";
import { SettingsRepository } from "../infrastructure/settings-repository.js";

@Injectable()
export class SettingsService {
  constructor(
    private readonly repo: SettingsRepository,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(FILE_STORAGE) private readonly files: IFileStorage,
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
      // a new logo must be a stored PNG or JPEG of at most 1 MB (it is printed on every document)
      if (next.org.logo && next.org.logo !== before.org.logo) {
        const f = await this.files.describe(next.org.logo).catch(() => null);
        if (!f || f.status !== "stored" || !["image/png", "image/jpeg"].includes(f.contentType) || f.byteSize > 1_048_576) {
          throw ValidationError("raqib.invalid_logo", "The logo must be an uploaded PNG or JPEG image of at most 1 MB.");
        }
      }
      const changed = diffSettings(before, next);
      if (!changed.length) return before;
      // a shift that visits already use keeps its name: it can be renamed, never removed
      const removed = before.schedule.shifts.map((s) => s.key).filter((k) => !next.schedule.shifts.some((s) => s.key === k));
      if (removed.length) {
        const used = await raqibDb().selectFrom("raqib_visits").select("shift").where("shift", "in", removed).limit(1).executeTakeFirst();
        if (used) throw Conflict("raqib.shift_in_use", "A shift that visits use cannot be removed. Rename it instead.", { shift: used.shift });
      }
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
