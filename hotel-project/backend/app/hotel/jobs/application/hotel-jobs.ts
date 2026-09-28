import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { AppError } from "@core/kernel/errors.js";
import { CLOCK, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import { runAsSystem, runWithContext } from "@core/kernel/logging/context.js";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import { SettingsService } from "@hotel/hotel/settings/application/settings-service.js";
import { ReservationsService } from "@hotel/hotel/reservations/application/reservations-service.js";
import {
  ReservationsRepository,
  type ReservationRecord,
} from "@hotel/hotel/reservations/infrastructure/reservations-repository.js";
import { hotelDb } from "@hotel/hotel/db/executor.js";

const log = moduleLogger("hotel-jobs");

/** An unconfirmed hold is released if nobody confirms it within this time. */
export const HOLD_TTL_HOURS = 48;

export interface JobsReport {
  noShows: number;
  expiredHolds: number;
}

/**
 * The hotel's scheduled housekeeping of the books, run for every property:
 *
 *   • auto no-show — a confirmed booking whose arrival night has passed without a check-in;
 *   • hold expiry  — an unconfirmed (pending) booking not confirmed within HOLD_TTL_HOURS, or
 *                    whose arrival night has passed. Cancelling releases its room.
 *
 * Both go through the reservation state machine as the SYSTEM actor, so history, audit and
 * events read "System". Each booking is its own transaction and re-checks its status under the
 * row lock, so the jobs are idempotent and two runners at once can't double-apply anything.
 */
@Injectable()
export class HotelJobs {
  constructor(
    private readonly reservations: ReservationsService,
    private readonly repo: ReservationsRepository,
    private readonly settings: SettingsService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  /**
   * Properties with bookings the jobs could act on. (Hotel settings are written lazily, so they
   * aren't a list of properties; open bookings are exactly where there is work to do.)
   */
  async organizations(): Promise<string[]> {
    const rows = await runAsSystem(() =>
      this.uow.transaction(() =>
        hotelDb()
          .selectFrom("hotel_reservations")
          .select("organization_id")
          .distinct()
          .where("status", "in", ["pending", "confirmed"])
          .execute(),
      ),
    );
    return rows.map((r) => r.organization_id);
  }

  async runAll(): Promise<JobsReport> {
    const total: JobsReport = { noShows: 0, expiredHolds: 0 };
    for (const org of await this.organizations()) {
      const r = await this.runFor(org);
      total.noShows += r.noShows;
      total.expiredHolds += r.expiredHolds;
    }
    return total;
  }

  /** Run the jobs for one property, in its tenant context (RLS applies). */
  runFor(organizationId: string): Promise<JobsReport> {
    return runWithContext({ correlationId: `jobs-${organizationId}`, organizationId }, async () => {
      const today = await readInTenant(() => this.settings.today());
      const holdCutoff = new Date(this.clock.now().getTime() - HOLD_TTL_HOURS * 3_600_000);
      const [overdue, holds] = await readInTenant(() =>
        Promise.all([this.repo.overdueArrivals(today), this.repo.expiredHolds(holdCutoff, today)]),
      );
      const noShows = await this.each(overdue, "confirmed", (r) =>
        this.reservations.applyTransition(
          r,
          "no_show",
          null,
          "Didn't arrive — marked automatically",
        ),
      );
      const expiredHolds = await this.each(holds, "pending", (r) =>
        this.reservations.applyTransition(r, "cancel", null, "Hold expired — never confirmed"),
      );
      if (noShows + expiredHolds > 0) {
        log.info({ organizationId, noShows, expiredHolds }, "hotel jobs applied");
      }
      return { noShows, expiredHolds };
    });
  }

  /** One transaction per booking; skip any that changed since it was listed. */
  private async each(
    ids: string[],
    expected: "confirmed" | "pending",
    apply: (r: ReservationRecord) => Promise<unknown>,
  ): Promise<number> {
    let done = 0;
    for (const id of ids) {
      try {
        const applied = await this.uow.transaction(async () => {
          const r = await this.reservations.lockAndLoad(id);
          if (r.status !== expected) return false;
          await apply(r);
          return true;
        });
        if (applied) done++;
      } catch (err) {
        if (!(err instanceof AppError)) throw err;
        log.warn({ reservationId: id, code: err.code }, "hotel job skipped a booking");
      }
    }
    return done;
  }
}
