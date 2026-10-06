import { Inject, Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { currentExecutor, unitOfWork, type UnitOfWork } from "@core/kernel/db/db.js";
import { NotFound } from "@core/kernel/errors.js";
import { runAsSystem } from "@core/kernel/logging/context.js";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import { AUDIT_LOGGER, CLOCK, FILE_STORAGE, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IAuditLogger, IFileStorage } from "@core/contracts/index.js";
import { requireCan, type Access } from "@raqib/raqib/access/access.js";
import { raqibDb } from "@raqib/raqib/db/executor.js";
import { SettingsService } from "@raqib/raqib/settings/application/settings-service.js";
import { open, seal } from "@raqib/raqib/shared/data-key.js";
import { readRaqibConfig } from "@raqib/config.js";

const log = moduleLogger("raqib-lifecycle");
const DAY = 86_400_000;
const PURGE_BATCH = 200;
/** An upload nobody attached within this long is abandoned. */
const ABANDONED_AFTER_HOURS = 48;

export interface RetentionReport {
  requestsErased: number;
  evidencePurged: number;
  uploadsPurged: number;
}

/**
 * What happens to personal data over time.
 *  - National ID numbers are stored sealed (AES-GCM); `sealLegacy` seals any that predate that, at every boot.
 *  - Decided account requests lose their personal details after `RAQIB_ACCOUNT_REQUEST_RETENTION_DAYS`.
 *  - Evidence older than the organization's attachment retention (settings → attachments, years; 0 = keep) is deleted from
 *    storage; the evidence row stays, flagged purged.
 *  - Audit entries are append-only at the database level and are never deleted by the application: the audit retention
 *    setting is the minimum the organization commits to keep, enforced by archival outside the app.
 *  - A person's data can be exported on request (`exportPersonalData`); the confidential area is deliberately not part of it.
 */
@Injectable()
export class LifecycleService {
  constructor(
    private readonly settings: SettingsService,
    @Inject(FILE_STORAGE) private readonly files: IFileStorage,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  /** Seal national IDs written before field encryption existed (all organizations; idempotent). */
  async sealLegacy(): Promise<{ guards: number; requests: number }> {
    const out = { guards: 0, requests: 0 };
    for (const table of ["raqib_guards", "raqib_account_requests"] as const) {
      for (;;) {
        const n = await runAsSystem(() =>
          unitOfWork.transaction(async () => {
            const ex = currentExecutor();
            const rows = (
              await sql<{ id: string; national_id: string }>`
              SELECT id, national_id FROM ${sql.table(table)} WHERE national_id <> '' AND national_id NOT LIKE 'v1:%' LIMIT 500`.execute(ex)
            ).rows;
            for (const r of rows) await sql`UPDATE ${sql.table(table)} SET national_id = ${seal(r.national_id)} WHERE id = ${r.id}`.execute(ex);
            return rows.length;
          }),
        );
        if (table === "raqib_guards") out.guards += n;
        else out.requests += n;
        if (n < 500) break;
      }
    }
    if (out.guards || out.requests) log.info(out, "legacy national ids sealed");
    return out;
  }

  /** Retention for the organization in the current tenant context (called by the scheduled jobs). */
  async retention(): Promise<RetentionReport> {
    const now = this.clock.now();
    const s = await this.settings.current();
    const report: RetentionReport = { requestsErased: 0, evidencePurged: 0, uploadsPurged: 0 };

    const cutoff = new Date(now.getTime() - readRaqibConfig().accountRequestRetentionDays * DAY);
    report.requestsErased = await this.uow.transaction(async () => {
      const r = await raqibDb()
        .updateTable("raqib_account_requests")
        .set({
          name: "[erased]",
          email: sql<string>`'erased+' || id || '@erased.invalid'`,
          phone: "",
          national_id: "",
          employee_no: "",
          department: "",
          requested_projects: "",
          justification: "[erased]",
          signed_name: "[erased]",
          erased_at: now,
        })
        .where("status", "<>", "pending")
        .where("erased_at", "is", null)
        .where("decided_at", "<", cutoff)
        .executeTakeFirst();
      const n = Number(r.numUpdatedRows);
      if (n)
        await this.audit.record({
          actorId: null,
          actorType: "system",
          action: "raqib.retention.requests_erased",
          resourceType: "raqib_account_request",
          metadata: { count: n },
        });
      return n;
    });

    const years = s.attach.retention;
    if (years > 0) {
      const before = new Date(now.getTime() - years * 365 * DAY);
      const due = await this.uow.transaction(() =>
        raqibDb()
          .selectFrom("raqib_evidence")
          .select(["id", "file_id"])
          .where("removed_at", "is", null)
          .where("uploaded_at", "<", before)
          .orderBy("uploaded_at")
          .limit(PURGE_BATCH)
          .execute(),
      );
      for (const e of due) {
        try {
          await this.files.delete({ id: e.file_id }).catch((err: { code?: string }) => {
            if (err?.code !== "files.not_found") throw err; // already gone is fine
          });
          await this.uow.transaction(() => raqibDb().updateTable("raqib_evidence").set({ removed_at: now, purged_at: now }).where("id", "=", e.id).execute());
          report.evidencePurged += 1;
        } catch (err) {
          log.error({ err, evidenceId: e.id }, "evidence retention purge failed");
        }
      }
      if (report.evidencePurged)
        await this.uow.transaction(() =>
          this.audit.record({
            actorId: null,
            actorType: "system",
            action: "raqib.retention.evidence_purged",
            resourceType: "raqib_evidence",
            metadata: { count: report.evidencePurged, retentionYears: years },
          }),
        );
    }
    report.uploadsPurged = await this.purgeAbandonedUploads(now);
    return report;
  }

  /**
   * Files that were uploaded (or only started) but never attached to anything: a photo picked and then dropped, a tab closed
   * mid-upload. They are not reachable from the product, and on object storage they cost money for ever, so they are deleted
   * (row and object) once they are older than {@link ABANDONED_AFTER_HOURS}. Anything referenced by evidence, a confidential
   * attachment or a message is kept.
   */
  private async purgeAbandonedUploads(now: Date): Promise<number> {
    const cutoff = new Date(now.getTime() - ABANDONED_AFTER_HOURS * 3_600_000);
    const stale = await this.uow.transaction(
      async () =>
        (
          await sql<{ id: string }>`
          SELECT f.id FROM files f
           WHERE f.deleted_at IS NULL AND f.created_at < ${cutoff}
             AND NOT EXISTS (SELECT 1 FROM raqib_evidence e WHERE e.file_id = f.id)
             AND NOT EXISTS (SELECT 1 FROM raqib_conf_files c WHERE c.file_id = f.id)
             AND NOT EXISTS (SELECT 1 FROM messaging_message_attachments m WHERE m.file_id = f.id)
           ORDER BY f.created_at
           LIMIT ${PURGE_BATCH}`.execute(currentExecutor())
        ).rows,
    );
    let purged = 0;
    for (const f of stale) {
      try {
        await this.files.delete({ id: f.id });
        purged += 1;
      } catch (err) {
        if ((err as { code?: string })?.code === "files.not_found") purged += 1;
        else log.error({ err, fileId: f.id }, "abandoned upload cleanup failed");
      }
    }
    if (purged)
      await this.uow.transaction(() =>
        this.audit.record({
          actorId: null,
          actorType: "system",
          action: "raqib.retention.uploads_purged",
          resourceType: "file",
          metadata: { count: purged, olderThanHours: ABANDONED_AFTER_HOURS },
        }),
      );
    return purged;
  }

  /**
   * Everything the application holds about one person, as a single JSON document for a data-subject request. Needs the
   * users export right; the export itself is audited. Confidential reports are excluded on purpose (their own boundary).
   */
  async exportPersonalData(userId: string, who: Access): Promise<Record<string, unknown>> {
    requireCan(who, "users", "X");
    return this.uow.transaction(async () => {
      const db = raqibDb();
      const profile = await db.selectFrom("raqib_profiles").selectAll().where("user_id", "=", userId).executeTakeFirst();
      if (!profile) throw NotFound("raqib.user_not_found", "User not found.");
      const guard = await db.selectFrom("raqib_guards").selectAll().where("user_id", "=", userId).executeTakeFirst();
      const [assignments, visits, events, observations, actions, requests, training, evidence, requestRows] = await Promise.all([
        db
          .selectFrom("raqib_project_assignments")
          .select(["project_id", "valid_from", "valid_to", "reason", "created_at"])
          .where("user_id", "=", userId)
          .execute(),
        db.selectFrom("raqib_visits").select(["ref", "scheduled_date", "scheduled_time", "status", "visit_type"]).where("inspector_id", "=", userId).execute(),
        db.selectFrom("raqib_visit_events").select(["visit_id", "action", "from_status", "to_status", "reason", "at"]).where("actor_id", "=", userId).execute(),
        db.selectFrom("raqib_observations").select(["ref", "kind", "severity", "note", "created_at"]).where("reported_by", "=", userId).execute(),
        db
          .selectFrom("raqib_corrective_actions")
          .select(["ref", "priority", "due_date", "status", "created_at"])
          .where("responsible_id", "=", userId)
          .execute(),
        db.selectFrom("raqib_training_requests").select(["ref", "course", "status", "created_at"]).where("requested_by", "=", userId).execute(),
        guard
          ? db
              .selectFrom("raqib_training_requests")
              .select(["ref", "course", "reason", "status", "result", "created_at"])
              .where("guard_id", "=", guard.id)
              .execute()
          : Promise.resolve([]),
        db
          .selectFrom("raqib_evidence")
          .select(["name", "kind", "size_bytes", "context", "uploaded_at", "removed_at", "purged_at"])
          .where("uploaded_by", "=", userId)
          .execute(),
        db.selectFrom("raqib_account_requests").selectAll().where("user_id", "=", userId).execute(),
      ]);
      const iso = (d: Date | null | undefined) => d?.toISOString() ?? null;
      await this.audit.record({ actorId: who.userId, action: "raqib.personal_data.exported", resourceType: "user", resourceId: userId });
      return {
        generatedAt: iso(this.clock.now()),
        subject: userId,
        profile: {
          name: { ar: profile.name_ar, en: profile.name_en },
          title: { ar: profile.title_ar, en: profile.title_en },
          role: profile.role_key,
          employeeNo: profile.employee_no,
          phone: profile.phone,
          status: profile.status,
          createdAt: iso(profile.created_at),
          lastActiveAt: iso(profile.last_active_at),
        },
        guardRecord: guard
          ? {
              employeeNo: guard.employee_no,
              nationalId: open(guard.national_id),
              post: { ar: guard.post_ar, en: guard.post_en },
              shift: guard.shift,
              status: guard.status,
            }
          : null,
        projectAssignments: assignments,
        visitsAsInspector: visits,
        actionsTaken: events.map((e) => ({ ...e, at: iso(e.at) })),
        observationsReported: observations,
        correctiveActionsAssigned: actions,
        trainingRequestsMade: requests,
        trainingRequestsAboutThem: training,
        evidenceUploaded: evidence,
        accountRequests: requestRows.map((r) => ({
          ref: r.ref,
          name: r.name,
          email: r.email,
          phone: r.phone,
          nationalId: r.national_id ? open(r.national_id) : "",
          status: r.status,
          signedAt: iso(r.signed_at),
          erasedAt: iso(r.erased_at),
        })),
        notIncluded: "Confidential reports are held under a separate access rule and are not part of this export.",
      };
    });
  }
}
