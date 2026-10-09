import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { CLOCK, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import { runAsSystem, runWithContext } from "@core/kernel/logging/context.js";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import { BookingsService } from "@admit/admit/bookings/application/bookings-service.js";
import { BookingsRepository } from "@admit/admit/bookings/infrastructure/bookings-repository.js";

const log = moduleLogger("admit-jobs");

export interface JobsReport {
  expiredHolds: number;
}

/**
 * Admit's scheduled housekeeping, run for every organizer that has work:
 *
 *   - hold expiry - a booking still AWAITING_PAYMENT after its hold lapsed becomes EXPIRED, which puts its seats back on
 *                   sale, and the customer is emailed. A booking IN_REVIEW is never expired: a slow reviewer must not cost
 *                   a customer who already paid.
 *
 * Each organizer is its own tenant context and transaction; the job re-checks status under the row lock (SKIP LOCKED), so
 * two runners at once cannot double-apply anything, and a customer submitting proof at the deadline wins cleanly.
 */
@Injectable()
export class AdmitJobs {
  constructor(
    private readonly bookings: BookingsService,
    private readonly repo: BookingsRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  /** Organizers with a lapsed hold - cross-tenant, so on the system connection. */
  async organizations(): Promise<string[]> {
    return runAsSystem(() => this.uow.transaction(() => this.repo.organizationsWithLapsedHolds(this.clock.now())));
  }

  async runAll(): Promise<JobsReport> {
    const total: JobsReport = { expiredHolds: 0 };
    for (const org of await this.organizations()) {
      try {
        total.expiredHolds += await this.runFor(org);
      } catch (err) {
        log.error({ err, organizationId: org }, "admit jobs failed for organizer");
      }
    }
    return total;
  }

  private runFor(organizationId: string): Promise<number> {
    return runWithContext({ correlationId: `jobs-${organizationId}`, organizationId }, async () => {
      let expired = 0;
      for (;;) {
        const n = await this.bookings.expireLapsedHolds(100);
        expired += n;
        if (n < 100) return expired;
      }
    });
  }
}
