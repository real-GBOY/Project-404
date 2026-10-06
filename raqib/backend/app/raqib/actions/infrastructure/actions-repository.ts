import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { getContext } from "@core/kernel/logging/context.js";
import { raqibDb } from "@raqib/raqib/db/executor.js";
import { raqibId } from "@raqib/raqib/shared/ids.js";
import type { L10n } from "@raqib/raqib/shared/l10n.js";
import type { ActionStatus } from "../domain/action-state.js";
import { fetchSize, type Page } from "@raqib/raqib/shared/paging.js";

export type Priority = "low" | "medium" | "high";

export interface ActionRecord {
  id: string;
  ref: string;
  observationId: string;
  projectId: string;
  title: L10n;
  description: string;
  priority: Priority;
  responsibleId: string;
  dueDate: string;
  status: ActionStatus;
  round: number;
  createdBy: string | null;
  createdAt: Date;
  startedAt: Date | null;
  submittedAt: Date | null;
  closedAt: Date | null;
  overdueNotifiedAt: Date | null;
}

export interface NewAction {
  ref: string;
  observationId: string;
  projectId: string;
  title: L10n;
  description: string;
  priority: Priority;
  responsibleId: string;
  dueDate: string;
  createdBy: string | null;
}

export interface ActionEventRecord {
  id: string;
  actionId: string;
  kind: "created" | "started" | "submitted" | "comment" | "returned" | "closed" | "reassigned";
  fromStatus: string | null;
  toStatus: string | null;
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
  if (!id) throw new Error("actions repository used outside a tenant context");
  return id;
};

type Row = {
  id: string;
  ref: string;
  observation_id: string;
  project_id: string;
  title_ar: string;
  title_en: string;
  description: string;
  priority: Priority;
  responsible_id: string;
  due_date: string;
  status: ActionStatus;
  round: number;
  created_by: string | null;
  created_at: Date;
  started_at: Date | null;
  submitted_at: Date | null;
  closed_at: Date | null;
  overdue_notified_at: Date | null;
};
const toRecord = (r: Row): ActionRecord => ({
  id: r.id,
  ref: r.ref,
  observationId: r.observation_id,
  projectId: r.project_id,
  title: { ar: r.title_ar, en: r.title_en },
  description: r.description,
  priority: r.priority,
  responsibleId: r.responsible_id,
  dueDate: r.due_date,
  status: r.status,
  round: r.round,
  createdBy: r.created_by,
  createdAt: r.created_at,
  startedAt: r.started_at,
  submittedAt: r.submitted_at,
  closedAt: r.closed_at,
  overdueNotifiedAt: r.overdue_notified_at,
});

const columns = () =>
  [
    "id",
    "ref",
    "observation_id",
    "project_id",
    "title_ar",
    "title_en",
    "description",
    "priority",
    "responsible_id",
    sql<string>`due_date::text`.as("due_date"),
    "status",
    "round",
    "created_by",
    "created_at",
    "started_at",
    "submitted_at",
    "closed_at",
    "overdue_notified_at",
  ] as const;

@Injectable()
export class ActionsRepository {
  async insert(a: NewAction): Promise<string> {
    const id = raqibId("cax");
    await raqibDb()
      .insertInto("raqib_corrective_actions")
      .values({
        id,
        organization_id: org(),
        ref: a.ref,
        observation_id: a.observationId,
        project_id: a.projectId,
        title_ar: a.title.ar,
        title_en: a.title.en,
        description: a.description,
        priority: a.priority,
        responsible_id: a.responsibleId,
        due_date: sql`${a.dueDate}::date` as never,
        created_by: a.createdBy,
      })
      .execute();
    return id;
  }

  async find(id: string, lock = false): Promise<ActionRecord | null> {
    let q = raqibDb().selectFrom("raqib_corrective_actions").select(columns()).where("id", "=", id);
    if (lock) q = q.forUpdate();
    const r = await q.executeTakeFirst();
    return r ? toRecord(r as unknown as Row) : null;
  }

  async findByObservation(observationId: string): Promise<ActionRecord | null> {
    const r = await raqibDb().selectFrom("raqib_corrective_actions").select(columns()).where("observation_id", "=", observationId).executeTakeFirst();
    return r ? toRecord(r as unknown as Row) : null;
  }

  async list(projectIds?: string[], page?: Page): Promise<ActionRecord[]> {
    let q = raqibDb().selectFrom("raqib_corrective_actions").select(columns());
    if (projectIds) q = q.where("project_id", "in", projectIds.length ? projectIds : ["-"]);
    q = q.orderBy("created_at", "desc").orderBy("ref", "desc");
    if (page) q = q.limit(fetchSize(page)).offset(page.offset);
    return (await q.execute()).map((r) => toRecord(r as unknown as Row));
  }

  async update(
    id: string,
    patch: Partial<{
      status: ActionStatus;
      round: number;
      startedAt: Date;
      submittedAt: Date;
      closedAt: Date;
      overdueNotifiedAt: Date | null;
      responsibleId: string;
      dueDate: string;
    }>,
  ): Promise<void> {
    const set: Record<string, unknown> = {};
    if (patch.status) set.status = patch.status;
    if (patch.round !== undefined) set.round = patch.round;
    if (patch.startedAt) set.started_at = patch.startedAt;
    if (patch.submittedAt) set.submitted_at = patch.submittedAt;
    if (patch.closedAt) set.closed_at = patch.closedAt;
    if (patch.overdueNotifiedAt !== undefined) set.overdue_notified_at = patch.overdueNotifiedAt;
    if (patch.responsibleId) set.responsible_id = patch.responsibleId;
    if (patch.dueDate) set.due_date = patch.dueDate;
    await raqibDb()
      .updateTable("raqib_corrective_actions")
      .set(set as never)
      .where("id", "=", id)
      .execute();
  }

  /** Open work whose due date has passed and nobody has been told about yet. */
  async overdueCandidates(today: string): Promise<ActionRecord[]> {
    const rows = await raqibDb()
      .selectFrom("raqib_corrective_actions")
      .select(columns())
      .where("status", "in", ["assigned", "in_progress", "returned"])
      .where("overdue_notified_at", "is", null)
      .where(sql<boolean>`due_date < ${today}::date`)
      .execute();
    return rows.map((r) => toRecord(r as unknown as Row));
  }

  async appendEvent(e: Omit<ActionEventRecord, "id" | "at">): Promise<void> {
    await raqibDb()
      .insertInto("raqib_action_events")
      .values({
        id: raqibId("cal"),
        organization_id: org(),
        action_id: e.actionId,
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

  async events(actionId: string): Promise<ActionEventRecord[]> {
    const rows = await raqibDb().selectFrom("raqib_action_events").selectAll().where("action_id", "=", actionId).orderBy("seq").execute();
    return rows.map((r) => ({
      id: r.id,
      actionId: r.action_id,
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
