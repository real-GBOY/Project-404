import { Injectable } from "@nestjs/common";
import { readInTenant } from "@core/kernel/db/db.js";
import { AuditRepository } from "@core/audit/infrastructure/audit-repository.js";
import { UserDirectory } from "@core/identity/application/user-directory.js";
import { describeAction } from "../domain/activity-text.js";
import { ActivityLabels } from "../infrastructure/activity-labels.js";

/**
 * The design's Audit Log: Core's append-only audit trail for this hotel (RLS-scoped), each row
 * turned into "<who> <did what> <to what>" with a link. Reads only — Core owns the trail.
 */
@Injectable()
export class ActivityService {
  constructor(
    private readonly audit: AuditRepository,
    private readonly directory: UserDirectory,
    private readonly labels: ActivityLabels,
  ) {}

  list(q: { cursor?: string; limit: number; resourceType?: string }) {
    return readInTenant(async () => {
      const records = await this.audit.query({
        cursor: q.cursor,
        limit: q.limit,
        resourceType: q.resourceType,
      });
      const [names, subjects] = await Promise.all([
        this.directory.userNames(records.map((r) => r.actorId)),
        this.labels.resolve(records.map((r) => ({ type: r.resourceType, id: r.resourceId }))),
      ]);
      const items = records.map((r) => {
        const { verb, severity } = describeAction(r.action);
        // "Mona Farid signed in", not "Mona Farid signed in Mona Farid".
        const subject =
          r.resourceId && !(r.resourceType === "user" && r.resourceId === r.actorId)
            ? subjects.get(`${r.resourceType}:${r.resourceId}`)
            : undefined;
        const reason = (r.after as { reason?: unknown } | null)?.reason;
        return {
          id: r.id,
          actorName:
            r.actorType === "system" || !r.actorId ? "System" : (names.get(r.actorId) ?? "Someone"),
          verb,
          subject: subject?.label ?? null,
          href: subject?.href ?? null,
          detail: typeof reason === "string" ? reason : null,
          action: r.action,
          severity,
          at: r.createdAt,
        };
      });
      return {
        items,
        nextCursor: records.length === q.limit ? records[records.length - 1]!.id : null,
      };
    });
  }
}
