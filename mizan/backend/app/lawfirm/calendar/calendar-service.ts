import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { currentExecutor, readInTenant } from "@core/kernel/db/db.js";
import { NotFound } from "@core/kernel/errors.js";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { CLOCK, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import { LawfirmDirectory } from "@app/lawfirm/shared/directory.js";
import { HearingsRepository } from "@app/lawfirm/hearings/hearings-repository.js";
import { TasksRepository } from "@app/lawfirm/tasks/tasks-repository.js";
import { CalendarRepository, type EventKind } from "./calendar-repository.js";

export interface CalendarItem {
  id: string;
  kind: "hearing" | "deadline" | "event";
  eventKind?: string;
  title: string;
  at: string;
  endAt: string | null;
  matterId: string | null;
  matterTitle: string | null;
  owner: string | null;
  ownerId: string | null;
}

@Injectable()
export class CalendarService {
  constructor(
    private readonly repo: CalendarRepository,
    private readonly hearings: HearingsRepository,
    private readonly tasks: TasksRepository,
    private readonly directory: LawfirmDirectory,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async range(filter: { from?: string; to?: string; lawyerId?: string }) {
    const from = filter.from ?? "0000";
    const to = filter.to ?? "9999";
    return readInTenant(async () => {
      const items: CalendarItem[] = [];
      const matterInfo = await this.matterInfo();
      const nameFor = (id: string | null | undefined) => this.directory.userName(id);

      for (const h of await this.hearings.all()) {
        const at = h.scheduledAt.toISOString();
        if (at < from || at > to) continue;
        const mi = matterInfo.get(h.matterId);
        if (filter.lawyerId && mi?.leadLawyerId !== filter.lawyerId) continue;
        items.push({
          id: h.id,
          kind: "hearing",
          title: `${h.purpose} — ${mi?.reference ?? ""}`,
          at,
          endAt: null,
          matterId: h.matterId,
          matterTitle: mi?.title ?? null,
          owner: await nameFor(mi?.leadLawyerId),
          ownerId: mi?.leadLawyerId ?? null,
        });
      }

      for (const e of await this.repo.events()) {
        const at = e.startAt.toISOString();
        if (at < from || at > to) continue;
        if (filter.lawyerId && e.ownerId !== filter.lawyerId) continue;
        items.push({
          id: e.id,
          kind: e.kind === "court_filing" || e.kind === "reminder" ? "deadline" : "event",
          eventKind: e.kind,
          title: e.title,
          at,
          endAt: e.endAt?.toISOString() ?? null,
          matterId: e.matterId,
          matterTitle: e.matterId ? (matterInfo.get(e.matterId)?.title ?? null) : null,
          owner: await nameFor(e.ownerId),
          ownerId: e.ownerId,
        });
      }

      for (const t of await this.tasks.all()) {
        if (!t.dueAt || t.status === "done") continue;
        const at = t.dueAt.toISOString();
        if (at < from || at > to) continue;
        if (filter.lawyerId && t.assigneeId !== filter.lawyerId) continue;
        items.push({
          id: `task-${t.id}`,
          kind: "deadline",
          eventKind: "task",
          title: t.title,
          at,
          endAt: null,
          matterId: t.matterId,
          matterTitle: t.matterId ? (matterInfo.get(t.matterId)?.title ?? null) : null,
          owner: await nameFor(t.assigneeId),
          ownerId: t.assigneeId,
        });
      }

      items.sort((a, b) => a.at.localeCompare(b.at));
      return { items };
    });
  }

  async createEvent(
    input: { title: string; kind?: string; startAt?: string; endAt?: string | null; matterId?: string | null },
    actorId: string,
  ) {
    const row = await this.uow.transaction(() =>
      this.repo.create({
        title: input.title,
        kind: (input.kind as EventKind) ?? "meeting",
        startAt: input.startAt ? new Date(input.startAt) : this.clock.now(),
        endAt: input.endAt ? new Date(input.endAt) : null,
        matterId: input.matterId ?? null,
        ownerId: actorId,
      }),
    );
    return this.eventRow(row);
  }

  async updateEvent(
    id: string,
    patch: { title?: string; kind?: string; startAt?: string; endAt?: string | null },
  ) {
    const row = await this.uow.transaction(async () => {
      const existing = await this.repo.findById(id);
      if (!existing) throw NotFound("event.not_found", "Event not found.");
      return (await this.repo.update(id, {
        title: patch.title,
        kind: patch.kind as EventKind | undefined,
        startAt: patch.startAt ? new Date(patch.startAt) : undefined,
        endAt: patch.endAt === undefined ? undefined : patch.endAt ? new Date(patch.endAt) : null,
      }))!;
    });
    return this.eventRow(row);
  }

  async deleteEvent(id: string) {
    await this.uow.transaction(() => this.repo.remove(id));
  }

  private async matterInfo() {
    const rows = await currentExecutor()
      .selectFrom("lawfirm_matters")
      .select(["id", "title", "reference", "lead_lawyer_id"])
      .where("organization_id", "=", requireOrganizationId())
      .execute();
    return new Map(rows.map((r) => [r.id, { title: r.title, reference: r.reference, leadLawyerId: r.lead_lawyer_id }]));
  }

  private eventRow(e: { id: string; title: string; kind: EventKind; startAt: Date; endAt: Date | null; matterId: string | null; ownerId: string }) {
    return {
      id: e.id,
      title: e.title,
      kind: e.kind,
      startAt: e.startAt.toISOString(),
      endAt: e.endAt?.toISOString() ?? null,
      matterId: e.matterId,
      ownerId: e.ownerId,
    };
  }
}
