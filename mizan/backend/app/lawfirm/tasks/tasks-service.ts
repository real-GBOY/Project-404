import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { NotFound } from "@core/kernel/errors.js";
import { CLOCK, EVENT_BUS, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IEventBus } from "@core/contracts/index.js";
import { ActivityService } from "@app/lawfirm/activity/activity-service.js";
import { LawfirmDirectory } from "@app/lawfirm/shared/directory.js";
import { TasksRepository, type TaskPriority, type TaskRow, type TaskStatus } from "./tasks-repository.js";

const DAY = 86_400_000;

@Injectable()
export class TasksService {
  constructor(
    private readonly repo: TasksRepository,
    private readonly directory: LawfirmDirectory,
    private readonly activity: ActivityService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(EVENT_BUS) private readonly events: IEventBus,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async summary() {
    return readInTenant(async () => {
      const all = await this.repo.all();
      const now = this.clock.now().getTime();
      const week = now + 7 * DAY;
      const monthAgo = now - 30 * DAY;
      return {
        open: all.filter((t) => t.status !== "done").length,
        dueThisWeek: all.filter((t) => t.status !== "done" && t.dueAt && t.dueAt.getTime() <= week).length,
        overdue: all.filter((t) => t.status !== "done" && t.dueAt && t.dueAt.getTime() < now).length,
        completed30d: all.filter((t) => t.completedAt && t.completedAt.getTime() >= monthAgo).length,
      };
    });
  }

  async list(filter: {
    mine?: boolean;
    matterId?: string;
    status?: TaskStatus;
    range?: "today" | "week" | "overdue" | "all";
    actorId: string;
  }) {
    return readInTenant(async () => {
      let rows = await this.repo.all();
      const now = this.clock.now();
      if (filter.mine) rows = rows.filter((t) => t.assigneeId === filter.actorId);
      if (filter.matterId) rows = rows.filter((t) => t.matterId === filter.matterId);
      if (filter.status) rows = rows.filter((t) => t.status === filter.status);
      if (filter.range === "today")
        rows = rows.filter(
          (t) => t.dueAt && t.dueAt.toDateString() === now.toDateString() && t.status !== "done",
        );
      if (filter.range === "week")
        rows = rows.filter((t) => t.dueAt && t.dueAt.getTime() <= now.getTime() + 7 * DAY && t.status !== "done");
      if (filter.range === "overdue")
        rows = rows.filter((t) => t.dueAt && t.dueAt.getTime() < now.getTime() && t.status !== "done");

      rows.sort((a, b) => (a.dueAt?.getTime() ?? 9e15) - (b.dueAt?.getTime() ?? 9e15));
      const items = await Promise.all(rows.map((t) => this.view(t)));
      return { items, total: items.length };
    });
  }

  async create(
    input: { title: string; matterId?: string | null; assigneeId?: string | null; priority?: TaskPriority; dueAt?: string | null },
    actorId: string,
  ) {
    const task = await this.uow.transaction(() =>
      this.repo.create({
        title: input.title,
        matterId: input.matterId ?? null,
        assigneeId: input.assigneeId ?? actorId,
        priority: input.priority ?? "normal",
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
      }),
    );
    return readInTenant(() => this.view(task));
  }

  async update(
    id: string,
    patch: { title?: string; priority?: TaskPriority; dueAt?: string | null; status?: TaskStatus; assigneeId?: string | null },
  ) {
    const task = await this.uow.transaction(async () => {
      const existing = await this.repo.findById(id);
      if (!existing) throw NotFound("task.not_found", "Task not found.");
      return (await this.repo.update(id, {
        title: patch.title,
        priority: patch.priority,
        dueAt: patch.dueAt === undefined ? undefined : patch.dueAt ? new Date(patch.dueAt) : null,
        status: patch.status,
        assigneeId: patch.assigneeId === undefined ? undefined : patch.assigneeId,
      }))!;
    });
    return readInTenant(() => this.view(task));
  }

  async toggleComplete(id: string, actorId: string) {
    const task = await this.uow.transaction(async () => {
      const existing = await this.repo.findById(id);
      if (!existing) throw NotFound("task.not_found", "Task not found.");
      const nextStatus: TaskStatus = existing.status === "done" ? "todo" : "done";
      const updated = await this.repo.update(id, {
        status: nextStatus,
        completedAt: nextStatus === "done" ? this.clock.now() : null,
      });
      if (nextStatus === "done") {
        await this.activity.record({
          actorId,
          action: "task.completed",
          targetType: "task",
          targetId: id,
          targetLabel: existing.title,
        });
        await this.events.publish({
          name: "lawfirm.task.completed",
          version: 1,
          payload: { taskId: id, actorId },
        });
      }
      return updated!;
    });
    return readInTenant(() => this.view(task));
  }

  async assign(id: string, assigneeId: string | null) {
    const task = await this.uow.transaction(async () => {
      const existing = await this.repo.findById(id);
      if (!existing) throw NotFound("task.not_found", "Task not found.");
      return (await this.repo.update(id, { assigneeId }))!;
    });
    return readInTenant(() => this.view(task));
  }

  private async view(t: TaskRow) {
    const matter = t.matterId ? await this.repo.matterContext(t.matterId) : null;
    const now = this.clock.now().getTime();
    return {
      id: t.id,
      title: t.title,
      matterId: t.matterId,
      matterTitle: matter?.title ?? null,
      matterReference: matter?.reference ?? null,
      assigneeId: t.assigneeId,
      assignee: await this.directory.userName(t.assigneeId),
      status: t.status,
      priority: t.priority,
      dueAt: t.dueAt?.toISOString() ?? null,
      overdue: !!t.dueAt && t.status !== "done" && t.dueAt.getTime() < now,
      createdAt: t.createdAt.toISOString(),
      completedAt: t.completedAt?.toISOString() ?? null,
    };
  }
}
