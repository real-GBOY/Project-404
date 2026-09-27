import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { hotelDb } from "@hotel/hotel/db/executor.js";
import { hotelId } from "@hotel/hotel/shared/ids.js";
import type { IsoDate } from "@hotel/hotel/shared/dates.js";
import { OPEN_TASK_STATUSES, type TaskStatus } from "../domain/task-state.js";

export type TaskKind = "checkout_clean" | "stayover" | "deep_clean";
export type TaskPriority = "low" | "normal" | "high";

export interface TaskRecord {
  id: string;
  roomId: string;
  roomNumber: string;
  floor: number;
  roomTypeName: string;
  reservationId: string | null;
  kind: TaskKind;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  notes: string | null;
  dueDate: IsoDate;
  startedAt: Date | null;
  completedAt: Date | null;
  inspectedAt: Date | null;
  createdAt: Date;
}

export interface TaskFilter {
  status?: TaskStatus;
  open?: boolean;
  assigneeId?: string;
  dueOn?: IsoDate;
}

@Injectable()
export class HousekeepingRepository {
  private org() {
    return requireOrganizationId();
  }

  private base() {
    return hotelDb()
      .selectFrom("hotel_housekeeping_tasks as k")
      .innerJoin("hotel_rooms as r", (j) =>
        j.onRef("r.id", "=", "k.room_id").onRef("r.organization_id", "=", "k.organization_id"),
      )
      .innerJoin("hotel_room_types as t", (j) =>
        j.onRef("t.id", "=", "r.room_type_id").onRef("t.organization_id", "=", "r.organization_id"),
      )
      .where("k.organization_id", "=", this.org())
      .select([
        "k.id",
        "k.room_id",
        "r.number as room_number",
        "r.floor",
        "t.name as room_type_name",
        "k.reservation_id",
        "k.kind",
        "k.status",
        "k.priority",
        "k.assignee_id",
        "k.notes",
        sql<string>`k.due_date::text`.as("due_date"),
        "k.started_at",
        "k.completed_at",
        "k.inspected_at",
        "k.created_at",
      ]);
  }

  async list(filter: TaskFilter = {}): Promise<TaskRecord[]> {
    let q = this.base();
    if (filter.status) q = q.where("k.status", "=", filter.status);
    if (filter.open) q = q.where("k.status", "in", [...OPEN_TASK_STATUSES]);
    if (filter.assigneeId) q = q.where("k.assignee_id", "=", filter.assigneeId);
    if (filter.dueOn) q = q.where(sql<boolean>`k.due_date = ${filter.dueOn}::date`);
    const rows = await q
      .orderBy(sql`CASE k.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END`)
      .orderBy("k.due_date")
      .orderBy("r.floor")
      .orderBy("r.number")
      .limit(500)
      .execute();
    return rows.map((r) => this.toRecord(r));
  }

  async findById(id: string, lock = false): Promise<TaskRecord | null> {
    if (lock) {
      await hotelDb()
        .selectFrom("hotel_housekeeping_tasks")
        .select("id")
        .where("organization_id", "=", this.org())
        .where("id", "=", id)
        .forUpdate()
        .execute();
    }
    const row = await this.base().where("k.id", "=", id).executeTakeFirst();
    return row ? this.toRecord(row) : null;
  }

  async openTaskForRoom(roomId: string): Promise<TaskRecord | null> {
    const row = await this.base()
      .where("k.room_id", "=", roomId)
      .where("k.status", "in", [...OPEN_TASK_STATUSES])
      .executeTakeFirst();
    return row ? this.toRecord(row) : null;
  }

  async create(input: {
    roomId: string;
    reservationId: string | null;
    kind: TaskKind;
    priority: TaskPriority;
    dueDate: IsoDate;
    notes: string | null;
    createdBy: string | null;
  }): Promise<string> {
    const id = hotelId("hkt");
    await hotelDb()
      .insertInto("hotel_housekeeping_tasks")
      .values({
        id,
        organization_id: this.org(),
        room_id: input.roomId,
        reservation_id: input.reservationId,
        kind: input.kind,
        priority: input.priority,
        due_date: input.dueDate,
        notes: input.notes,
        created_by: input.createdBy,
      })
      .execute();
    return id;
  }

  async update(
    id: string,
    patch: {
      status?: TaskStatus;
      assigneeId?: string | null;
      startedAt?: Date;
      completedAt?: Date;
      inspectedAt?: Date;
      inspectedBy?: string;
      notes?: string | null;
      priority?: TaskPriority;
    },
  ): Promise<void> {
    await hotelDb()
      .updateTable("hotel_housekeeping_tasks")
      .set({
        ...(patch.status !== undefined && { status: patch.status }),
        ...(patch.assigneeId !== undefined && { assignee_id: patch.assigneeId }),
        ...(patch.startedAt !== undefined && { started_at: patch.startedAt }),
        ...(patch.completedAt !== undefined && { completed_at: patch.completedAt }),
        ...(patch.inspectedAt !== undefined && { inspected_at: patch.inspectedAt }),
        ...(patch.inspectedBy !== undefined && { inspected_by: patch.inspectedBy }),
        ...(patch.notes !== undefined && { notes: patch.notes }),
        ...(patch.priority !== undefined && { priority: patch.priority }),
      })
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .execute();
  }

  private toRecord(r: {
    id: string;
    room_id: string;
    room_number: string;
    floor: number;
    room_type_name: string;
    reservation_id: string | null;
    kind: TaskKind;
    status: TaskStatus;
    priority: TaskPriority;
    assignee_id: string | null;
    notes: string | null;
    due_date: string;
    started_at: Date | null;
    completed_at: Date | null;
    inspected_at: Date | null;
    created_at: Date;
  }): TaskRecord {
    return {
      id: r.id,
      roomId: r.room_id,
      roomNumber: r.room_number,
      floor: r.floor,
      roomTypeName: r.room_type_name,
      reservationId: r.reservation_id,
      kind: r.kind,
      status: r.status,
      priority: r.priority,
      assigneeId: r.assignee_id,
      notes: r.notes,
      dueDate: r.due_date,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      inspectedAt: r.inspected_at,
      createdAt: r.created_at,
    };
  }
}
