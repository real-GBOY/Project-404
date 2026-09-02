import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { NotFound, ValidationError } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, CLOCK, EVENT_BUS, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IAuditLogger, IEventBus } from "@core/contracts/index.js";
import { ActivityService } from "@app/lawfirm/activity/activity-service.js";
import { LawfirmDirectory } from "@app/lawfirm/shared/directory.js";
import { HearingsRepository, type HearingRow, type HearingStatus } from "./hearings-repository.js";

const DAY = 86_400_000;

@Injectable()
export class HearingsService {
  constructor(
    private readonly repo: HearingsRepository,
    private readonly directory: LawfirmDirectory,
    private readonly activity: ActivityService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(EVENT_BUS) private readonly events: IEventBus,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async summary() {
    return readInTenant(async () => {
      const all = await this.repo.all();
      const now = this.clock.now().getTime();
      const week = now + 7 * DAY;
      const quarterAgo = now - 90 * DAY;
      return {
        scheduled: all.filter((h) => h.status === "scheduled").length,
        next7: all.filter(
          (h) => h.status === "scheduled" && h.scheduledAt.getTime() >= now && h.scheduledAt.getTime() <= week,
        ).length,
        awaitingDate: all.filter((h) => h.status === "scheduled" && !h.court).length,
        adjournedQuarter: all.filter((h) => h.status === "adjourned" && h.scheduledAt.getTime() >= quarterAgo).length,
      };
    });
  }

  async list(filter: {
    matterId?: string;
    status?: HearingStatus;
    from?: string;
    to?: string;
    scope?: "upcoming" | "past";
  }) {
    return readInTenant(async () => {
      let rows = await this.repo.list({
        matterId: filter.matterId,
        status: filter.status,
        from: filter.from ? new Date(filter.from) : undefined,
        to: filter.to ? new Date(filter.to) : undefined,
      });
      const now = this.clock.now().getTime();
      if (filter.scope === "upcoming") rows = rows.filter((h) => h.scheduledAt.getTime() >= now);
      if (filter.scope === "past") rows = rows.filter((h) => h.scheduledAt.getTime() < now);
      const items = await Promise.all(rows.map((h) => this.view(h)));
      return { items, total: items.length };
    });
  }

  async get(id: string) {
    const hearing = await readInTenant(() => this.repo.findById(id));
    if (!hearing) throw NotFound("hearing.not_found", "Hearing not found.");
    return readInTenant(() => this.view(hearing));
  }

  async create(
    input: { matterId: string; court?: string; scheduledAt?: string; purpose?: string },
    actorId: string,
  ) {
    const hearing = await this.uow.transaction(async () => {
      const matter = await this.repo.matterContext(input.matterId);
      if (!matter) throw ValidationError("matter.not_found", "Unknown matter.");
      const created = await this.repo.create({
        matterId: input.matterId,
        court: input.court ?? matter.court ?? "—",
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : this.clock.now(),
        purpose: input.purpose ?? "Hearing",
      });
      await this.activity.record({
        actorId,
        action: "hearing.scheduled",
        targetType: "hearing",
        targetId: created.id,
        targetLabel: `${created.purpose} — ${matter.title}`,
      });
      await this.audit.record({
        actorId,
        action: "lawfirm.hearing.scheduled",
        resourceType: "lawfirm_hearing",
        resourceId: created.id,
        after: created,
      });
      await this.events.publish({
        name: "lawfirm.hearing.scheduled",
        version: 1,
        payload: { hearingId: created.id, matterId: input.matterId, actorId },
      });
      return created;
    });
    return readInTenant(() => this.view(hearing));
  }

  async update(
    id: string,
    patch: { court?: string; scheduledAt?: string; purpose?: string },
    actorId: string,
  ) {
    const hearing = await this.uow.transaction(async () => {
      const existing = await this.repo.findById(id);
      if (!existing) throw NotFound("hearing.not_found", "Hearing not found.");
      const updated = await this.repo.update(id, {
        court: patch.court,
        scheduledAt: patch.scheduledAt ? new Date(patch.scheduledAt) : undefined,
        purpose: patch.purpose,
      });
      await this.audit.record({
        actorId,
        action: "lawfirm.hearing.updated",
        resourceType: "lawfirm_hearing",
        resourceId: id,
        before: existing,
        after: updated,
      });
      return updated!;
    });
    return readInTenant(() => this.view(hearing));
  }

  /** Close this session `adjourned` and open a new `scheduled` one (PLAN F7). */
  async adjourn(id: string, newDate: string, reason: string | undefined, actorId: string) {
    const result = await this.uow.transaction(async () => {
      const existing = await this.repo.findById(id);
      if (!existing) throw NotFound("hearing.not_found", "Hearing not found.");
      const matter = await this.repo.matterContext(existing.matterId);
      await this.repo.update(id, { status: "adjourned", outcome: reason ?? "Adjourned." });
      const next = await this.repo.create({
        matterId: existing.matterId,
        court: existing.court,
        scheduledAt: new Date(newDate),
        purpose: existing.purpose,
      });
      await this.activity.record({
        actorId,
        action: "hearing.adjourned",
        targetType: "hearing",
        targetId: id,
        targetLabel: `${existing.purpose} — ${matter?.title ?? ""}`,
      });
      await this.events.publish({
        name: "lawfirm.hearing.adjourned",
        version: 1,
        payload: { hearingId: id, nextHearingId: next.id, actorId },
      });
      return { adjourned: (await this.repo.findById(id))!, next };
    });
    return {
      adjourned: await readInTenant(() => this.view(result.adjourned)),
      next: await readInTenant(() => this.view(result.next)),
    };
  }

  async recordOutcome(id: string, outcome: string, actorId: string) {
    const hearing = await this.uow.transaction(async () => {
      const existing = await this.repo.findById(id);
      if (!existing) throw NotFound("hearing.not_found", "Hearing not found.");
      const updated = await this.repo.update(id, { status: "decided", outcome });
      await this.activity.record({
        actorId,
        action: "hearing.decided",
        targetType: "hearing",
        targetId: id,
        targetLabel: existing.purpose,
      });
      await this.events.publish({
        name: "lawfirm.hearing.decided",
        version: 1,
        payload: { hearingId: id, actorId },
      });
      return updated!;
    });
    return readInTenant(() => this.view(hearing));
  }

  private async view(h: HearingRow) {
    const matter = await this.repo.matterContext(h.matterId);
    return {
      id: h.id,
      matterId: h.matterId,
      matterTitle: matter?.title ?? "—",
      matterReference: matter?.reference ?? "—",
      clientName: matter?.clientName ?? "—",
      leadLawyer: matter ? ((await this.directory.userName(matter.leadLawyerId)) ?? "—") : "—",
      court: h.court,
      scheduledAt: h.scheduledAt.toISOString(),
      status: h.status,
      purpose: h.purpose,
      outcome: h.outcome,
    };
  }
}
