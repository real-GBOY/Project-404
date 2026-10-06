import { Injectable } from "@nestjs/common";
import { readInTenant } from "@core/kernel/db/db.js";
import { AuditRepository, type AuditRecord } from "@core/audit/infrastructure/audit-repository.js";
import { requireCan, type Access } from "@raqib/raqib/access/access.js";
import { AccessRepository } from "@raqib/raqib/access/infrastructure/access-repository.js";
import { csvField } from "@raqib/raqib/analytics/application/analytics-service.js";
import type { L10n } from "@raqib/raqib/shared/l10n.js";

export interface AuditQueryInput {
  q?: string;
  entity?: string;
  actor?: string;
  from?: string;
  to?: string;
}

export interface AuditEntryView {
  id: string;
  at: string;
  actor: { id: string | null; name: L10n; role: string | null; system: boolean };
  action: string;
  entity: string;
  ref: string | null;
  before: unknown;
  after: unknown;
  reason: string | null;
  correlationId: string | null;
}

const PAGE = 200;
const MAX_PAGES = 5;

/** The organization's audit trail, as the audit module's holders read it. Entries are written elsewhere; nothing here changes them. */
@Injectable()
export class AuditService {
  constructor(
    private readonly audit: AuditRepository,
    private readonly access: AccessRepository,
  ) {}

  async list(
    q: AuditQueryInput,
    who: Access,
  ): Promise<{ items: AuditEntryView[]; entities: string[]; actors: Array<{ id: string; name: L10n }>; truncated: boolean }> {
    requireCan(who, "audit", "V");
    return readInTenant(async () => {
      const profiles = new Map((await this.access.allProfiles()).map((p) => [p.userId, p]));
      const needle = (q.q ?? "").trim().toLowerCase();
      const out: AuditRecord[] = [];
      let cursor: string | undefined;
      let truncated = false;
      for (let page = 0; page < MAX_PAGES; page++) {
        const rows = await this.audit.query({
          ...(q.entity ? { resourceType: q.entity } : {}),
          ...(q.actor ? { actorId: q.actor } : {}),
          ...(q.from ? { from: new Date(`${q.from}T00:00:00Z`) } : {}),
          ...(q.to ? { to: new Date(`${q.to}T23:59:59.999Z`) } : {}),
          limit: PAGE,
          ...(cursor ? { cursor } : {}),
        });
        out.push(...rows);
        if (rows.length < PAGE) break;
        cursor = rows.at(-1)!.id;
        if (page === MAX_PAGES - 1) truncated = true;
      }
      const name = (id: string | null): L10n => {
        const p = id ? profiles.get(id) : undefined;
        return p ? { ar: p.nameAr, en: p.nameEn } : { ar: "النظام", en: "System" };
      };
      const items = out
        .map((r): AuditEntryView => ({
          id: r.id,
          at: r.createdAt.toISOString(),
          actor: { id: r.actorId, name: name(r.actorId), role: r.actorId ? (profiles.get(r.actorId)?.roleKey ?? null) : null, system: !r.actorId },
          action: r.action,
          entity: r.resourceType,
          ref: r.resourceId,
          before: r.before,
          after: r.after,
          reason: typeof r.metadata?.reason === "string" ? (r.metadata.reason as string) : null,
          correlationId: r.correlationId,
        }))
        .filter(
          (e) =>
            !needle ||
            [e.action, e.entity, e.ref, e.reason, e.actor.name.en, e.actor.name.ar].some((x) =>
              String(x ?? "")
                .toLowerCase()
                .includes(needle),
            ),
        );
      return {
        items,
        entities: [...new Set(out.map((r) => r.resourceType))].sort(),
        actors: [...profiles.values()].map((p) => ({ id: p.userId, name: { ar: p.nameAr, en: p.nameEn } })),
        truncated,
      };
    });
  }

  async csv(q: AuditQueryInput, who: Access): Promise<string> {
    requireCan(who, "audit", "X");
    const { items } = await this.list(q, who);
    const rows = [
      ["When (UTC)", "Who", "Action", "Entity", "Reference", "Reason"],
      ...items.map((e) => [e.at, e.actor.name.en, e.action, e.entity, e.ref ?? "", e.reason ?? ""]),
    ];
    return `${String.fromCharCode(0xfeff)}${rows.map((r) => r.map(csvField).join(",")).join("\r\n")}\r\n`;
  }
}
