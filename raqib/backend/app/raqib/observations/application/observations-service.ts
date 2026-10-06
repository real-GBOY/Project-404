import { Inject, Injectable } from "@nestjs/common";
import { readInTenant, type UnitOfWork } from "@core/kernel/db/db.js";
import { Forbidden, NotFound, ValidationError } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { IAuditLogger } from "@core/contracts/index.js";
import { can, inScope, requireCan, requireProject, type Access } from "@raqib/raqib/access/access.js";
import { AccessService } from "@raqib/raqib/access/application/access-service.js";
import type { InspectionView } from "@raqib/raqib/inspections/application/inspections-service.js";
import { ProjectsRepository } from "@raqib/raqib/projects/infrastructure/projects-repository.js";
import { Counters } from "@raqib/raqib/shared/counters.js";
import type { L10n } from "@raqib/raqib/shared/l10n.js";
import { VisitsRepository } from "@raqib/raqib/visits/infrastructure/visits-repository.js";
import type { VisitView } from "@raqib/raqib/visits/application/visits-service.js";
import { effectiveActionStatus, type ActionStatus } from "@raqib/raqib/actions/domain/action-state.js";
import { ObservationsRepository, type ObservationRecord, type Severity } from "../infrastructure/observations-repository.js";
import type { Page } from "@raqib/raqib/shared/paging.js";

export interface ObservationView {
  id: string;
  ref: string;
  kind: "violation" | "observation";
  title: L10n;
  note: string;
  severity: Severity;
  repeatCount: number;
  project: { id: string; code: string; name: L10n };
  site: L10n;
  visit: { id: string; ref: string } | null;
  itemNum: string | null;
  /** The form item's stable key (links repeat findings of the same item). */
  itemKey: string | null;
  reportedBy: L10n;
  createdAt: string;
  action: { id: string; ref: string; status: string; dueDate: string; priority: string; responsible: L10n } | null;
}

export interface CreateObservationInput {
  projectId: string;
  siteId: string;
  text: string;
  note: string;
  severity: Severity;
}

@Injectable()
export class ObservationsService {
  constructor(
    private readonly repo: ObservationsRepository,
    private readonly projects: ProjectsRepository,
    private readonly visits: VisitsRepository,
    private readonly access: AccessService,
    private readonly counters: Counters,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async list(who: Access, page?: Page): Promise<ObservationView[]> {
    requireCan(who, "observations", "V");
    return readInTenant(async () => this.views(await this.repo.list(who.allProjects ? undefined : [...who.projectIds], page), who));
  }

  async get(id: string, who: Access): Promise<ObservationView> {
    return readInTenant(async () => {
      if (!can(who, "observations", "V")) throw Forbidden("raqib.forbidden", "Your role is not permitted to do this (observations:V).");
      const o = await this.repo.find(id);
      if (!o) throw NotFound("raqib.observation_not_found", "Observation not found.");
      if (!inScope(who, o.projectId)) throw Forbidden("raqib.out_of_scope", "This observation belongs to a project outside your scope.");
      return (await this.views([o], who))[0]!;
    });
  }

  /** An observation reported directly (not from a scored inspection item). */
  async create(input: CreateObservationInput, who: Access): Promise<ObservationView> {
    requireCan(who, "observations", "A");
    const id = await this.uow.transaction(async () => {
      requireProject(who, input.projectId);
      const site = await this.projects.findSite(input.siteId);
      if (!site || site.projectId !== input.projectId) throw ValidationError("raqib.site_not_in_project", "This site does not belong to the project.");
      const ref = await this.counters.next("OBS", Number(who.today.slice(0, 4)));
      const id = await this.repo.insert({
        ref,
        kind: "observation",
        projectId: input.projectId,
        siteId: input.siteId,
        title: { ar: input.text, en: input.text },
        note: input.note,
        severity: input.severity,
        repeatCount: 0,
        reportedBy: who.userId,
        reportedByName: { ar: who.nameAr, en: who.nameEn },
      });
      await this.audit.record({
        actorId: who.userId,
        action: "raqib.observation.created",
        resourceType: "raqib_observation",
        resourceId: id,
        after: { ref, severity: input.severity, projectId: input.projectId },
      });
      return id;
    });
    // the reporter may be allowed to add observations without being allowed to browse them: answer from the new row directly
    return readInTenant(async () => (await this.views([(await this.repo.find(id))!], who))[0]!);
  }

  /**
   * Every non-compliant item of an approved inspection becomes a violation (once). Runs inside the approval
   * transaction, with the approver's authority already established — it is not an endpoint. The repeat count is how
   * many earlier findings of the same form item exist at the same site.
   */
  async recordViolations(visit: VisitView, inspection: InspectionView, who: Access): Promise<number> {
    const existing = await this.repo.existingItemIds(inspection.id);
    let n = 0;
    for (const item of inspection.sections.flatMap((s) => s.items)) {
      if (item.answer !== "n" || existing.has(item.id)) continue;
      const repeatCount = await this.repo.priorCount(visit.site.id, item.key);
      const ref = await this.counters.next("OBS", Number(visit.date.slice(0, 4)));
      await this.repo.insert({
        ref,
        kind: "violation",
        projectId: visit.project.id,
        siteId: visit.site.id,
        visitId: visit.id,
        inspectionId: inspection.id,
        itemId: item.id,
        itemKey: item.key,
        itemNum: item.num,
        title: item.text,
        note: item.note,
        severity: item.severity ?? "medium",
        repeatCount,
        reportedBy: visit.inspector?.id ?? who.userId,
        reportedByName: visit.inspector?.name ?? { ar: who.nameAr, en: who.nameEn },
      });
      n++;
    }
    if (n)
      await this.audit.record({
        actorId: who.userId,
        action: "raqib.observations.recorded",
        resourceType: "raqib_inspection",
        resourceId: inspection.id,
        metadata: { violations: n },
      });
    return n;
  }

  private async views(rows: ObservationRecord[], who: Access): Promise<ObservationView[]> {
    const projects = new Map((await this.projects.list()).map((p) => [p.id, p]));
    const sites = new Map((await this.projects.sites()).map((s) => [s.id, s]));
    const actions = await this.repo.actionSummaries(rows.map((r) => r.id));
    const names = new Map<string, L10n>();
    const nameOf = async (userId: string): Promise<L10n> => {
      if (!names.has(userId)) {
        const p = await this.access.profileOf(userId);
        names.set(userId, p ? { ar: p.nameAr, en: p.nameEn } : { ar: "—", en: "—" });
      }
      return names.get(userId)!;
    };
    const visitRefs = new Map<string, string>();
    for (const id of new Set(rows.map((r) => r.visitId).filter((x): x is string => !!x))) visitRefs.set(id, (await this.visits.find(id))?.ref ?? "");
    const out: ObservationView[] = [];
    for (const r of rows) {
      const p = projects.get(r.projectId);
      const a = actions.get(r.id);
      out.push({
        id: r.id,
        ref: r.ref,
        kind: r.kind,
        title: r.title,
        note: r.note,
        severity: r.severity,
        repeatCount: r.repeatCount,
        project: { id: r.projectId, code: p?.code ?? "", name: p?.name ?? { ar: "—", en: "—" } },
        site: sites.get(r.siteId)?.name ?? { ar: "—", en: "—" },
        visit: r.visitId ? { id: r.visitId, ref: visitRefs.get(r.visitId) ?? "" } : null,
        itemNum: r.itemNum,
        itemKey: r.itemKey,
        reportedBy: r.reportedByName,
        createdAt: r.createdAt.toISOString(),
        action: a
          ? {
              id: a.id,
              ref: a.ref,
              status: effectiveActionStatus(a.status as ActionStatus, a.dueDate, who.today),
              dueDate: a.dueDate,
              priority: a.priority,
              responsible: await nameOf(a.responsibleId),
            }
          : null,
      });
    }
    return out;
  }
}
