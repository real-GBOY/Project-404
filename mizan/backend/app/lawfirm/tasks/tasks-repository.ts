import { Injectable } from "@nestjs/common";
import { currentExecutor } from "@core/kernel/db/db.js";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { lawfirmId } from "@app/lawfirm/shared/ids.js";

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "normal" | "high";

export interface TaskRow {
  id: string;
  title: string;
  matterId: string | null;
  assigneeId: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: Date | null;
  createdAt: Date;
  completedAt: Date | null;
}

@Injectable()
export class TasksRepository {
  private org(): string {
    return requireOrganizationId();
  }

  async all(): Promise<TaskRow[]> {
    const rows = await currentExecutor()
      .selectFrom("lawfirm_tasks")
      .selectAll()
      .where("organization_id", "=", this.org())
      .execute();
    return rows.map((r) => this.toRow(r));
  }

  async findById(id: string): Promise<TaskRow | null> {
    const row = await currentExecutor()
      .selectFrom("lawfirm_tasks")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? this.toRow(row) : null;
  }

  async create(input: {
    title: string;
    matterId: string | null;
    assigneeId: string | null;
    priority: TaskPriority;
    dueAt: Date | null;
  }): Promise<TaskRow> {
    const id = lawfirmId("tsk");
    await currentExecutor()
      .insertInto("lawfirm_tasks")
      .values({
        id,
        organization_id: this.org(),
        title: input.title,
        matter_id: input.matterId,
        assignee_id: input.assigneeId,
        status: "todo",
        priority: input.priority,
        due_at: input.dueAt,
      })
      .execute();
    return (await this.findById(id))!;
  }

  async update(
    id: string,
    patch: Partial<{
      title: string;
      priority: TaskPriority;
      dueAt: Date | null;
      status: TaskStatus;
      assigneeId: string | null;
      completedAt: Date | null;
    }>,
  ): Promise<TaskRow | null> {
    const set: Record<string, unknown> = {};
    if (patch.title !== undefined) set.title = patch.title;
    if (patch.priority !== undefined) set.priority = patch.priority;
    if (patch.dueAt !== undefined) set.due_at = patch.dueAt;
    if (patch.status !== undefined) set.status = patch.status;
    if (patch.assigneeId !== undefined) set.assignee_id = patch.assigneeId;
    if (patch.completedAt !== undefined) set.completed_at = patch.completedAt;
    if (Object.keys(set).length > 0) {
      await currentExecutor()
        .updateTable("lawfirm_tasks")
        .set(set)
        .where("organization_id", "=", this.org())
        .where("id", "=", id)
        .execute();
    }
    return this.findById(id);
  }

  async matterContext(matterId: string): Promise<{ title: string; reference: string } | null> {
    const row = await currentExecutor()
      .selectFrom("lawfirm_matters")
      .select(["title", "reference"])
      .where("organization_id", "=", this.org())
      .where("id", "=", matterId)
      .executeTakeFirst();
    return row ?? null;
  }

  private toRow(r: {
    id: string;
    title: string;
    matter_id: string | null;
    assignee_id: string | null;
    status: TaskStatus;
    priority: TaskPriority;
    due_at: Date | string | null;
    created_at: Date | string;
    completed_at: Date | string | null;
  }): TaskRow {
    return {
      id: r.id,
      title: r.title,
      matterId: r.matter_id,
      assigneeId: r.assignee_id,
      status: r.status,
      priority: r.priority,
      dueAt: r.due_at ? new Date(r.due_at) : null,
      createdAt: new Date(r.created_at),
      completedAt: r.completed_at ? new Date(r.completed_at) : null,
    };
  }
}
