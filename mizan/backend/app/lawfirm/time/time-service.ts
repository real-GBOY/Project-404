import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { NotFound, ValidationError } from "@core/kernel/errors.js";
import { CLOCK, EVENT_BUS, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IEventBus } from "@core/contracts/index.js";
import { ActivityService } from "@app/lawfirm/activity/activity-service.js";
import { LawfirmDirectory } from "@app/lawfirm/shared/directory.js";
import { moneyList } from "@app/lawfirm/shared/money.js";
import { SettingsService } from "@app/lawfirm/settings/settings-service.js";
import {
  TimeRepository,
  type TimeEntryCurrency,
  type TimeEntryRow,
  type TimeEntryStatus,
} from "./time-repository.js";

function hoursOf(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

function entryValue(e: TimeEntryRow): number {
  return e.billable && e.hourlyRate ? (e.minutes / 60) * e.hourlyRate : 0;
}

@Injectable()
export class TimeService {
  constructor(
    private readonly repo: TimeRepository,
    private readonly directory: LawfirmDirectory,
    private readonly activity: ActivityService,
    private readonly settings: SettingsService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(EVENT_BUS) private readonly events: IEventBus,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async list(filter: {
    mine?: boolean;
    matterId?: string;
    status?: TimeEntryStatus;
    actorId: string;
  }) {
    return readInTenant(async () => {
      const rows = await this.repo.list({
        userId: filter.mine ? filter.actorId : undefined,
        matterId: filter.matterId,
        status: filter.status,
      });
      const items = await Promise.all(rows.map((r) => this.view(r)));
      return { items, total: items.length };
    });
  }

  /** Unbilled time grouped by matter — feeds the mobile Finance roll-up. */
  async summary(filter: { mine?: boolean; actorId: string }) {
    return readInTenant(async () => {
      const rows = await this.repo.list({
        userId: filter.mine ? filter.actorId : undefined,
        status: "unbilled",
      });
      const byMatter = new Map<
        string,
        { matterId: string; minutes: number; value: number; currency: string }
      >();
      for (const r of rows) {
        const cur = byMatter.get(r.matterId) ?? {
          matterId: r.matterId,
          minutes: 0,
          value: 0,
          currency: r.currency,
        };
        cur.minutes += r.minutes;
        cur.value += entryValue(r);
        byMatter.set(r.matterId, cur);
      }
      const items = await Promise.all(
        [...byMatter.values()].map(async (m) => {
          const matter = await this.repo.matterContext(m.matterId);
          return {
            matterId: m.matterId,
            matterTitle: matter?.title ?? null,
            matterReference: matter?.reference ?? null,
            minutes: m.minutes,
            hours: hoursOf(m.minutes),
            value: m.value > 0 ? moneyList([{ currency: m.currency, amount: m.value }]) : [],
            currency: m.currency,
          };
        }),
      );
      const totals = moneyList(
        [...byMatter.values()].map((m) => ({ currency: m.currency, amount: m.value })),
      );
      const totalMinutes = rows.reduce((sum, r) => sum + r.minutes, 0);
      return { items, totals, totalMinutes, totalHours: hoursOf(totalMinutes) };
    });
  }

  async create(
    input: {
      matterId: string;
      activity: string;
      narrative?: string | null;
      minutes: number;
      billable?: boolean;
      loggedAt?: string | null;
    },
    actorId: string,
  ) {
    const settings = await this.settings.get();
    const rate = settings.standardRates[0]?.hourlyRate ?? null;
    const currency = (settings.defaultCurrency as TimeEntryCurrency) ?? "EGP";

    const entry = await this.uow.transaction(async () => {
      const matter = await this.repo.matterContext(input.matterId);
      if (!matter) throw ValidationError("matter.not_found", "Unknown matter.");
      const created = await this.repo.create({
        matterId: input.matterId,
        userId: actorId,
        activity: input.activity,
        narrative: input.narrative?.trim() ? input.narrative.trim() : null,
        minutes: input.minutes,
        billable: input.billable ?? true,
        hourlyRate: rate,
        currency,
        loggedAt: input.loggedAt ? new Date(input.loggedAt) : this.clock.now(),
      });
      await this.activity.record({
        actorId,
        action: "time.logged",
        targetType: "matter",
        targetId: input.matterId,
        targetLabel: `${hoursOf(created.minutes)}h — ${created.activity}`,
      });
      await this.events.publish({
        name: "lawfirm.time_entry.logged",
        version: 1,
        payload: { timeEntryId: created.id, matterId: input.matterId, actorId },
      });
      return created;
    });
    return readInTenant(() => this.view(entry));
  }

  async update(
    id: string,
    patch: {
      activity?: string;
      narrative?: string | null;
      minutes?: number;
      billable?: boolean;
      loggedAt?: string | null;
    },
  ) {
    const entry = await this.uow.transaction(async () => {
      const existing = await this.repo.findById(id);
      if (!existing) throw NotFound("time_entry.not_found", "Time entry not found.");
      if (existing.status === "billed")
        throw ValidationError("time_entry.billed", "A billed time entry can't be edited.");
      return (await this.repo.update(id, {
        activity: patch.activity,
        narrative:
          patch.narrative === undefined
            ? undefined
            : patch.narrative?.trim()
              ? patch.narrative.trim()
              : null,
        minutes: patch.minutes,
        billable: patch.billable,
        loggedAt:
          patch.loggedAt === undefined
            ? undefined
            : patch.loggedAt
              ? new Date(patch.loggedAt)
              : this.clock.now(),
      }))!;
    });
    return readInTenant(() => this.view(entry));
  }

  async remove(id: string) {
    await this.uow.transaction(async () => {
      const existing = await this.repo.findById(id);
      if (!existing) throw NotFound("time_entry.not_found", "Time entry not found.");
      if (existing.status === "billed")
        throw ValidationError("time_entry.billed", "A billed time entry can't be deleted.");
      await this.repo.remove(id);
    });
    return { ok: true };
  }

  private async view(e: TimeEntryRow) {
    const matter = await this.repo.matterContext(e.matterId);
    return {
      id: e.id,
      matterId: e.matterId,
      matterTitle: matter?.title ?? null,
      matterReference: matter?.reference ?? null,
      userId: e.userId,
      loggedBy: (await this.directory.userName(e.userId)) ?? null,
      activity: e.activity,
      narrative: e.narrative,
      minutes: e.minutes,
      hours: hoursOf(e.minutes),
      billable: e.billable,
      hourlyRate: e.hourlyRate,
      currency: e.currency,
      value: entryValue(e) > 0 ? moneyList([{ currency: e.currency, amount: entryValue(e) }]) : [],
      status: e.status,
      loggedAt: e.loggedAt.toISOString(),
      createdAt: e.createdAt.toISOString(),
    };
  }
}
