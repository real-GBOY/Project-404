import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { currentExecutor, unitOfWork } from "@core/kernel/db/db.js";
import { getContext } from "@core/kernel/logging/context.js";
import { raqibDb } from "@raqib/raqib/db/executor.js";
import { raqibId } from "@raqib/raqib/shared/ids.js";
import type { L10n } from "@raqib/raqib/shared/l10n.js";

export type ConfKind = "misconduct" | "violation" | "safety";
export type Sensitivity = "standard" | "high";
export type IdentityMode = "named" | "confidential" | "anonymous";
export type ConfStatus = "new" | "under_review" | "closed";
export type GrantLevel = "view" | "respond";
export type GrantScope = "all" | "standard";
export type ConfAction = "enter" | "exit" | "view_list" | "view_report" | "respond" | "status" | "reveal_identity" | "open_file" | "grant_issued" | "grant_revoked" | "submit";

export interface ConfReportRecord {
  id: string;
  ref: string;
  kind: ConfKind;
  sensitivity: Sensitivity;
  subject: string;
  body: string;
  place: string;
  identityMode: IdentityMode;
  status: ConfStatus;
  response: string | null;
  respondedAt: Date | null;
  createdAt: Date;
}

export interface ConfGrantRecord {
  id: string;
  userId: string;
  level: GrantLevel;
  scope: GrantScope;
  reason: string;
  grantedBy: L10n;
  grantedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedBy: L10n | null;
  revokeReason: string | null;
}

export interface ConfLogRecord {
  id: string;
  action: ConfAction;
  actorId: string | null;
  actor: L10n;
  reportRef: string | null;
  reason: string | null;
  device: string | null;
  at: Date;
}

const org = (): string => {
  const id = getContext()?.organizationId;
  if (!id) throw new Error("confidential repository used outside a tenant context");
  return id;
};

/**
 * Every query here must run inside `confidentially()`: a transaction in which the application has authorized
 * access to the confidential tables (the restrictive RLS policy reads `app.conf_access`). Outside it the tables
 * look empty and refuse writes, whatever the caller does.
 */
export async function confidentially<T>(fn: () => Promise<T>): Promise<T> {
  return unitOfWork.transaction(async () => {
    await sql`select set_config('app.conf_access', 'on', true)`.execute(currentExecutor());
    return fn();
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toReport = (r: any): ConfReportRecord => ({
  id: r.id, ref: r.ref, kind: r.kind, sensitivity: r.sensitivity, subject: r.subject, body: r.body, place: r.place, identityMode: r.identity_mode,
  status: r.status, response: r.response, respondedAt: r.responded_at, createdAt: r.created_at,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toGrant = (r: any): ConfGrantRecord => ({
  id: r.id, userId: r.user_id, level: r.level, scope: r.scope, reason: r.reason, grantedBy: { ar: r.granted_by_name_ar, en: r.granted_by_name_en }, grantedAt: r.granted_at,
  expiresAt: r.expires_at, revokedAt: r.revoked_at, revokedBy: r.revoked_by_name_en ? { ar: r.revoked_by_name_ar, en: r.revoked_by_name_en } : null, revokeReason: r.revoke_reason,
});

@Injectable()
export class ConfRepository {
  async insertReport(r: Pick<ConfReportRecord, "ref" | "kind" | "sensitivity" | "subject" | "body" | "place" | "identityMode">): Promise<string> {
    const id = raqibId("cnf");
    await raqibDb()
      .insertInto("raqib_conf_reports")
      .values({ id, organization_id: org(), ref: r.ref, kind: r.kind, sensitivity: r.sensitivity, subject: r.subject, body: r.body, place: r.place, identity_mode: r.identityMode })
      .execute();
    return id;
  }

  async insertIdentity(reportId: string, i: { userId: string; name: L10n; employeeNo: string }): Promise<void> {
    await raqibDb()
      .insertInto("raqib_conf_identities")
      .values({ organization_id: org(), report_id: reportId, user_id: i.userId, name_ar: i.name.ar, name_en: i.name.en, employee_no: i.employeeNo })
      .execute();
  }

  async identity(reportId: string): Promise<{ userId: string; name: L10n; employeeNo: string } | null> {
    const r = await raqibDb().selectFrom("raqib_conf_identities").selectAll().where("report_id", "=", reportId).executeTakeFirst();
    return r ? { userId: r.user_id, name: { ar: r.name_ar, en: r.name_en }, employeeNo: r.employee_no } : null;
  }

  async mine(userId: string): Promise<ConfReportRecord[]> {
    const rows = await raqibDb()
      .selectFrom("raqib_conf_identities as i")
      .innerJoin("raqib_conf_reports as r", (j) => j.onRef("r.id", "=", "i.report_id").onRef("r.organization_id", "=", "i.organization_id"))
      .selectAll("r")
      .where("i.user_id", "=", userId)
      .orderBy("r.created_at", "desc")
      .execute();
    return rows.map(toReport);
  }

  async insertFile(reportId: string, f: { fileId: string; name: string; mime: string; sizeBytes: number }): Promise<void> {
    await raqibDb()
      .insertInto("raqib_conf_files")
      .values({ id: raqibId("evd"), organization_id: org(), report_id: reportId, file_id: f.fileId, name: f.name, mime: f.mime, size_bytes: f.sizeBytes as never })
      .execute();
  }

  async files(reportId: string): Promise<Array<{ id: string; fileId: string; name: string; mime: string; sizeBytes: number }>> {
    const rows = await raqibDb().selectFrom("raqib_conf_files").selectAll().where("report_id", "=", reportId).orderBy("created_at").execute();
    return rows.map((r) => ({ id: r.id, fileId: r.file_id, name: r.name, mime: r.mime, sizeBytes: Number(r.size_bytes) }));
  }

  async file(reportId: string, id: string) {
    return (await this.files(reportId)).find((f) => f.id === id) ?? null;
  }

  async list(scope: GrantScope): Promise<ConfReportRecord[]> {
    let q = raqibDb().selectFrom("raqib_conf_reports").selectAll();
    if (scope === "standard") q = q.where("sensitivity", "=", "standard");
    return (await q.orderBy("created_at", "desc").execute()).map(toReport);
  }

  async find(id: string, lock = false): Promise<ConfReportRecord | null> {
    let q = raqibDb().selectFrom("raqib_conf_reports").selectAll().where("id", "=", id);
    if (lock) q = q.forUpdate();
    const r = await q.executeTakeFirst();
    return r ? toReport(r) : null;
  }

  async update(id: string, patch: Partial<{ status: ConfStatus; response: string }>): Promise<void> {
    const set: Record<string, unknown> = {};
    if (patch.status) set.status = patch.status;
    if (patch.response !== undefined) {
      set.response = patch.response;
      set.responded_at = sql`now()`;
    }
    await raqibDb().updateTable("raqib_conf_reports").set(set as never).where("id", "=", id).execute();
  }

  // ── grants ─────────────────────────────────────────────────────────────

  async insertGrant(g: { userId: string; level: GrantLevel; scope: GrantScope; reason: string; grantedBy: string; grantedByName: L10n; expiresAt: Date }): Promise<string> {
    const id = raqibId("cgr");
    await raqibDb()
      .insertInto("raqib_conf_grants")
      .values({
        id, organization_id: org(), user_id: g.userId, level: g.level, scope: g.scope, reason: g.reason, granted_by: g.grantedBy,
        granted_by_name_ar: g.grantedByName.ar, granted_by_name_en: g.grantedByName.en, expires_at: g.expiresAt,
      })
      .execute();
    return id;
  }

  async grants(): Promise<ConfGrantRecord[]> {
    return (await raqibDb().selectFrom("raqib_conf_grants").selectAll().orderBy("granted_at", "desc").execute()).map(toGrant);
  }

  async findGrant(id: string, lock = false): Promise<ConfGrantRecord | null> {
    let q = raqibDb().selectFrom("raqib_conf_grants").selectAll().where("id", "=", id);
    if (lock) q = q.forUpdate();
    const r = await q.executeTakeFirst();
    return r ? toGrant(r) : null;
  }

  async revokeGrant(id: string, by: { userId: string; name: L10n }, reason: string): Promise<void> {
    await raqibDb()
      .updateTable("raqib_conf_grants")
      .set({ revoked_at: sql`now()` as never, revoked_by: by.userId, revoked_by_name_ar: by.name.ar, revoked_by_name_en: by.name.en, revoke_reason: reason })
      .where("id", "=", id)
      .execute();
  }

  /** The person's currently valid grant: not revoked, not expired. */
  async activeGrant(userId: string, now: Date): Promise<ConfGrantRecord | null> {
    const r = await raqibDb()
      .selectFrom("raqib_conf_grants")
      .selectAll()
      .where("user_id", "=", userId)
      .where("revoked_at", "is", null)
      .where("expires_at", ">", now)
      .orderBy("granted_at", "desc")
      .executeTakeFirst();
    return r ? toGrant(r) : null;
  }

  async activeGrantHolders(now: Date): Promise<string[]> {
    const rows = await raqibDb().selectFrom("raqib_conf_grants").select("user_id").where("revoked_at", "is", null).where("expires_at", ">", now).execute();
    return [...new Set(rows.map((r) => r.user_id))];
  }

  // ── protected log ──────────────────────────────────────────────────────

  async log(e: { at: Date; action: ConfAction; actorId: string | null; actor: L10n; reportRef?: string | null; reason?: string | null; device?: string | null }): Promise<void> {
    await raqibDb()
      .insertInto("raqib_conf_access_log")
      .values({
        id: raqibId("cal2"), organization_id: org(), action: e.action, actor_id: e.actorId, actor_name_ar: e.actor.ar, actor_name_en: e.actor.en,
        report_ref: e.reportRef ?? null, reason: e.reason ?? null, device: e.device ?? null, at: e.at,
      })
      .execute();
  }

  async recentLog(limit: number): Promise<ConfLogRecord[]> {
    const rows = await raqibDb().selectFrom("raqib_conf_access_log").selectAll().orderBy("seq", "desc").limit(limit).execute();
    return rows.map((r) => ({ id: r.id, action: r.action, actorId: r.actor_id, actor: { ar: r.actor_name_ar, en: r.actor_name_en }, reportRef: r.report_ref, reason: r.reason, device: r.device, at: r.at }));
  }

  /** The person's open session: their latest `enter` is within the window and not followed by an `exit`. */
  async lastSessionEvent(userId: string): Promise<{ action: "enter" | "exit"; at: Date } | null> {
    const r = await raqibDb()
      .selectFrom("raqib_conf_access_log")
      .select(["action", "at"])
      .where("actor_id", "=", userId)
      .where("action", "in", ["enter", "exit"])
      .orderBy("seq", "desc")
      .limit(1)
      .executeTakeFirst();
    return r ? { action: r.action as "enter" | "exit", at: r.at } : null;
  }

  async revealedBy(userId: string, reportRef: string): Promise<boolean> {
    const r = await raqibDb()
      .selectFrom("raqib_conf_access_log")
      .select("id")
      .where("actor_id", "=", userId)
      .where("action", "=", "reveal_identity")
      .where("report_ref", "=", reportRef)
      .executeTakeFirst();
    return !!r;
  }
}
