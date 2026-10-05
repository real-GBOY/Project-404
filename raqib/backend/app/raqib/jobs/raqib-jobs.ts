import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { currentExecutor } from "@core/kernel/db/db.js";
import { runAsSystem, withContext } from "@core/kernel/logging/context.js";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import { CLOCK, EVENT_BUS, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IEventBus } from "@core/contracts/index.js";
import { SettingsService } from "@raqib/raqib/settings/application/settings-service.js";
import { visitOverdue } from "@raqib/raqib/visits/events.js";
import { effectiveStatus } from "@raqib/raqib/visits/domain/visit-state.js";
import { VisitsRepository } from "@raqib/raqib/visits/infrastructure/visits-repository.js";

const log = moduleLogger("raqib-jobs");

export interface JobsReport {
  organizations: number;
  visitsMarkedOverdue: number;
}

/**
 * Scheduled work, run per organization in that tenant's context. Idempotent: a visit is announced overdue once
 * (`overdue_notified_at`), re-checked under the row lock so two runners cannot both announce it.
 */
@Injectable()
export class RaqibJobs {
  constructor(
    private readonly visits: VisitsRepository,
    private readonly settings: SettingsService,
    @Inject(EVENT_BUS) private readonly events: IEventBus,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async runAll(): Promise<JobsReport> {
    const orgs = await runAsSystem(() => currentExecutor().selectFrom("organizations").select("id").execute());
    const report: JobsReport = { organizations: orgs.length, visitsMarkedOverdue: 0 };
    for (const org of orgs) {
      try {
        await withContext({ userId: undefined, organizationId: org.id }, async () => {
          report.visitsMarkedOverdue += await this.overdueVisits();
        });
      } catch (err) {
        log.error({ err, organizationId: org.id }, "raqib jobs failed for organization");
      }
    }
    return report;
  }

  /** Visits that have waited past the overdue window without starting. */
  async overdueVisits(): Promise<number> {
    const s = await this.settings.current();
    const now = this.clock.now();
    const waiting = await this.uow.transaction(() => this.visits.list({ statuses: ["scheduled", "assigned"] }));
    const candidates = waiting.filter((v) => !v.overdueNotifiedAt && effectiveStatus(v, now, s.insp.overdueHours, s.org.tz) === "overdue");
    let n = 0;
    for (const c of candidates) {
      await this.uow.transaction(async () => {
        const v = await this.visits.find(c.id, true);
        if (!v || v.overdueNotifiedAt || (v.status !== "scheduled" && v.status !== "assigned")) return;
        if (effectiveStatus(v, now, s.insp.overdueHours, s.org.tz) !== "overdue") return;
        await this.visits.update(v.id, { overdueNotifiedAt: now });
        await this.events.publish(visitOverdue({ visitId: v.id }));
        n++;
      });
    }
    return n;
  }
}
