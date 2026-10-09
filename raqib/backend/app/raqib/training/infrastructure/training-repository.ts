import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { getContext } from "@core/kernel/logging/context.js";
import { raqibDb } from "@raqib/raqib/db/executor.js";
import { raqibId } from "@raqib/raqib/shared/ids.js";
import { pinnedBusinessDate } from "@raqib/raqib/shared/business-date.js";
import type { RequesterKind, TrainingStatus } from "../domain/training-state.js";
import { fetchSize, type Page } from "@raqib/raqib/shared/paging.js";

export type TrainingReason = "low_score" | "repeat_issue" | "incident" | "refresher" | "new_assignment";
export type TrainingResult = "passed" | "attended" | "failed";
export type Priority = "low" | "medium" | "high";

export interface TrainingRecord {
  id: string;
  ref: string;
  guardId: string;
  projectId: string;
  reason: TrainingReason;
  course: string;
  related: string;
  priority: Priority;
  notes: string;
  status: TrainingStatus;
  round: number;
  requestedBy: string | null;
  /** Who asked: a supervisor, or a guard for themselves (which decides the approval chain). */
  requesterKind: RequesterKind;
  scheduledDate: string | null;
  provider: string | null;
  completedDate: string | null;
  result: TrainingResult | null;
  resultNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewTraining {
  ref: string;
  guardId: string;
  projectId: string;
  reason: TrainingReason;
  course: string;
  related: string;
  priority: Priority;
  notes: string;
  requestedBy: string | null;
  requesterKind: RequesterKind;
  status: TrainingStatus;
}

export interface TrainingEventRecord {
  id: string;
  requestId: string;
  kind: "requested" | "reviewed" | "returned" | "resubmitted" | "approved" | "rejected" | "scheduled" | "completed";
  fromStatus: string | null;
  toStatus: string;
  text: string | null;
  actorId: string | null;
  actorNameAr: string;
  actorNameEn: string;
  actorRole: string | null;
  actorTitleAr: string;
  actorTitleEn: string;
  at: Date;
}

const org = (): string => {
  const id = getContext()?.organizationId;
  if (!id) throw new Error("training repository used outside a tenant context");
  return id;
};

const columns = () =>
  [
    "id",
    "ref",
    "guard_id",
    "project_id",
    "reason",
    "course",
    "related",
    "priority",
    "notes",
    "status",
    "round",
    "requested_by",
    "requester_kind",
    sql<string | null>`scheduled_date::text`.as("scheduled_date"),
    "provider",
    sql<string | null>`completed_date::text`.as("completed_date"),
    "result",
    "result_note",
    "created_at",
    "updated_at",
  ] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toRecord = (r: any): TrainingRecord => ({
  id: r.id,
  ref: r.ref,
  guardId: r.guard_id,
  projectId: r.project_id,
  reason: r.reason,
  course: r.course,
  related: r.related,
  priority: r.priority,
  notes: r.notes,
  status: r.status,
  round: r.round,
  requestedBy: r.requested_by,
  requesterKind: r.requester_kind,
  scheduledDate: r.scheduled_date,
  provider: r.provider,
  completedDate: r.completed_date,
  result: r.result,
  resultNote: r.result_note,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

@Injectable()
export class TrainingRepository {
  async insert(t: NewTraining): Promise<string> {
    const id = raqibId("trq");
    await raqibDb()
      .insertInto("raqib_training_requests")
      .values({
        id,
        organization_id: org(),
        ref: t.ref,
        guard_id: t.guardId,
        project_id: t.projectId,
        reason: t.reason,
        course: t.course,
        related: t.related,
        priority: t.priority,
        notes: t.notes,
        requested_by: t.requestedBy,
        requester_kind: t.requesterKind,
        status: t.status,
      })
      .execute();
    return id;
  }

  async find(id: string, lock = false): Promise<TrainingRecord | null> {
    let q = raqibDb().selectFrom("raqib_training_requests").select(columns()).where("id", "=", id);
    if (lock) q = q.forUpdate();
    const r = await q.executeTakeFirst();
    return r ? toRecord(r) : null;
  }

  async list(projectIds?: string[], guardId?: string, page?: Page): Promise<TrainingRecord[]> {
    let q = raqibDb().selectFrom("raqib_training_requests").select(columns());
    if (projectIds) q = q.where("project_id", "in", projectIds.length ? projectIds : ["-"]);
    if (guardId) q = q.where("guard_id", "=", guardId);
    q = q.orderBy("created_at", "desc").orderBy("ref", "desc");
    if (page) q = q.limit(fetchSize(page)).offset(page.offset);
    return (await q.execute()).map(toRecord);
  }

  async update(
    id: string,
    patch: Partial<{
      status: TrainingStatus;
      round: number;
      notes: string;
      scheduledDate: string;
      provider: string;
      completedDate: string;
      result: TrainingResult;
      resultNote: string | null;
    }>,
  ): Promise<void> {
    const set: Record<string, unknown> = {};
    if (patch.status) set.status = patch.status;
    if (patch.round !== undefined) set.round = patch.round;
    if (patch.notes !== undefined) set.notes = patch.notes;
    if (patch.scheduledDate) set.scheduled_date = sql`${patch.scheduledDate}::date`;
    if (patch.provider) set.provider = patch.provider;
    if (patch.completedDate) set.completed_date = sql`${patch.completedDate}::date`;
    if (patch.result) set.result = patch.result;
    if (patch.resultNote !== undefined) set.result_note = patch.resultNote;
    await raqibDb()
      .updateTable("raqib_training_requests")
      .set(set as never)
      .where("id", "=", id)
      .execute();
  }

  async appendEvent(e: Omit<TrainingEventRecord, "id" | "at">): Promise<void> {
    await raqibDb()
      .insertInto("raqib_training_events")
      .values({
        id: raqibId("cal"),
        organization_id: org(),
        // the demo seeder pins a business date so its history reads as it would have happened; real requests are never pinned
        ...(pinnedBusinessDate() ? { at: sql<Date>`(${pinnedBusinessDate()!}::date + time '09:00')::timestamptz` } : {}),
        request_id: e.requestId,
        kind: e.kind,
        from_status: e.fromStatus,
        to_status: e.toStatus,
        text: e.text,
        actor_id: e.actorId,
        actor_name_ar: e.actorNameAr,
        actor_name_en: e.actorNameEn,
        actor_role: e.actorRole,
        actor_title_ar: e.actorTitleAr,
        actor_title_en: e.actorTitleEn,
      })
      .execute();
  }

  async events(requestId: string): Promise<TrainingEventRecord[]> {
    const rows = await raqibDb().selectFrom("raqib_training_events").selectAll().where("request_id", "=", requestId).orderBy("seq").execute();
    return rows.map((r) => ({
      id: r.id,
      requestId: r.request_id,
      kind: r.kind,
      fromStatus: r.from_status,
      toStatus: r.to_status,
      text: r.text,
      actorId: r.actor_id,
      actorNameAr: r.actor_name_ar,
      actorNameEn: r.actor_name_en,
      actorRole: r.actor_role,
      actorTitleAr: r.actor_title_ar,
      actorTitleEn: r.actor_title_en,
      at: r.at,
    }));
  }
}
