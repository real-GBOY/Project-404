import { Injectable } from "@nestjs/common";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { realestateDb } from "@atlas/realestate/db/executor.js";
import { realestateId } from "@atlas/realestate/shared/ids.js";
import { combinedRelevance } from "@atlas/realestate/shared/search.js";

export type TaskPriority = "high" | "medium" | "low";
export type TaskStatus = "open" | "in-progress" | "done";

export interface TaskFilter {
  assigneeId?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  /** Free-text search across the task title, ranked by relevance. */
  q?: string;
}

export interface TaskRow {
  id: string;
  priority: TaskPriority;
  title: string;
  relatedType: string | null;
  relatedId: string | null;
  assigneeId: string;
  dueAt: Date;
  status: TaskStatus;
}

export interface CreateTaskInput {
  priority?: TaskPriority;
  title: string;
  relatedType?: string | null;
  relatedId?: string | null;
  assigneeId: string;
  dueAt: string;
}

@Injectable()
export class TasksRepository {
  private org(): string {
    return requireOrganizationId();
  }

  async list(filter: TaskFilter = {}): Promise<TaskRow[]> {
    let q = realestateDb().selectFrom("realestate_tasks").selectAll().where("organization_id", "=", this.org());
    if (filter.assigneeId) q = q.where("assignee_id", "=", filter.assigneeId);
    if (filter.priority) q = q.where("priority", "=", filter.priority);
    if (filter.status) q = q.where("status", "=", filter.status);

    const term = filter.q?.trim();
    if (term) {
      const score = combinedRelevance([{ column: "title" }], term);
      const rows = await q.select(score.as("relevance_score")).where(score, ">", 0).orderBy("relevance_score", "desc").orderBy("due_at", "asc").execute();
      return rows.map((r) => this.toRow(r));
    }

    const rows = await q.orderBy("due_at", "asc").execute();
    return rows.map((r) => this.toRow(r));
  }

  async findById(id: string): Promise<TaskRow | null> {
    const row = await realestateDb()
      .selectFrom("realestate_tasks")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? this.toRow(row) : null;
  }

  async create(input: CreateTaskInput): Promise<TaskRow> {
    const id = realestateId("tsk");
    await realestateDb()
      .insertInto("realestate_tasks")
      .values({
        id,
        organization_id: this.org(),
        priority: input.priority ?? "medium",
        title: input.title,
        related_type: input.relatedType ?? null,
        related_id: input.relatedId ?? null,
        assignee_id: input.assigneeId,
        due_at: input.dueAt,
      })
      .execute();
    return (await this.findById(id))!;
  }

  async updateStatus(id: string, status: TaskStatus): Promise<TaskRow | null> {
    await realestateDb()
      .updateTable("realestate_tasks")
      .set({ status })
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .execute();
    return this.findById(id);
  }

  private toRow(r: {
    id: string;
    priority: TaskPriority;
    title: string;
    related_type: string | null;
    related_id: string | null;
    assignee_id: string;
    due_at: Date | string;
    status: TaskStatus;
  }): TaskRow {
    return {
      id: r.id,
      priority: r.priority,
      title: r.title,
      relatedType: r.related_type,
      relatedId: r.related_id,
      assigneeId: r.assignee_id,
      dueAt: new Date(r.due_at),
      status: r.status,
    };
  }
}
