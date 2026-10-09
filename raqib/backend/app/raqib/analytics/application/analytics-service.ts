import { Injectable } from "@nestjs/common";
import { readInTenant } from "@core/kernel/db/db.js";
import { ValidationError } from "@core/kernel/errors.js";
import { requireCan, requireProject, type Access } from "@raqib/raqib/access/access.js";
import { ActionsRepository } from "@raqib/raqib/actions/infrastructure/actions-repository.js";
import { ObservationsRepository } from "@raqib/raqib/observations/infrastructure/observations-repository.js";
import { AccessRepository } from "@raqib/raqib/access/infrastructure/access-repository.js";
import { ProjectsRepository } from "@raqib/raqib/projects/infrastructure/projects-repository.js";
import { ReportsRepository } from "@raqib/raqib/reports/infrastructure/reports-repository.js";
import { ConfidentialService } from "@raqib/raqib/confidential/application/confidential-service.js";
import { SettingsService } from "@raqib/raqib/settings/application/settings-service.js";
import type { RankSort } from "../domain/project-ranking.js";
import { TrainingRepository } from "@raqib/raqib/training/infrastructure/training-repository.js";
import { VisitsRepository } from "@raqib/raqib/visits/infrastructure/visits-repository.js";
import { csvField } from "@raqib/raqib/shared/csv.js";
import type { L10n } from "@raqib/raqib/shared/l10n.js";
import { addDaysIso, computeAnalytics, type AnalyticsResult } from "../domain/analytics.js";

export type Period = "week" | "month" | "quarter" | "year" | "custom";
export interface AnalyticsQuery {
  period: Period;
  from?: string;
  to?: string;
  projectId?: string;
  siteId?: string;
  /** How the project ranking is ordered (default: needs attention first). */
  sort?: RankSort;
}

const SPAN: Record<Exclude<Period, "custom">, number> = { week: 7, month: 30, quarter: 90, year: 365 };

export { csvField };

/** Analytics over what the caller may see: the project scope is applied before any number is computed. */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly reports: ReportsRepository,
    private readonly visits: VisitsRepository,
    private readonly observations: ObservationsRepository,
    private readonly actions: ActionsRepository,
    private readonly training: TrainingRepository,
    private readonly projects: ProjectsRepository,
    private readonly confidential: ConfidentialService,
    private readonly settings: SettingsService,
    private readonly access: AccessRepository,
  ) {}

  async run(q: AnalyticsQuery, who: Access): Promise<AnalyticsResult> {
    requireCan(who, "analytics", "V");
    let from: string;
    let to: string;
    if (q.period === "custom") {
      if (!q.from || !q.to || q.from > q.to) throw ValidationError("raqib.invalid_range", "Choose a valid date range.");
      if (Date.parse(q.to) - Date.parse(q.from) > 366 * 86_400_000) throw ValidationError("raqib.range_too_long", "The range cannot exceed one year.");
      from = q.from;
      to = q.to;
    } else {
      to = who.today;
      from = addDaysIso(to, -(SPAN[q.period] - 1));
    }
    if (q.projectId) requireProject(who, q.projectId);
    const projectIds = q.projectId ? [q.projectId] : who.allProjects ? undefined : [...who.projectIds];
    return readInTenant(async () => {
      const siteName = q.siteId ? (await this.projects.findSite(q.siteId))?.name : undefined;
      const [reports, visits, observations, actions, training, allSites, profiles, projectRows, weights, complaints] = await Promise.all([
        this.reports.list(projectIds),
        this.visits.list({ projectIds, from, to }),
        this.observations.list(projectIds),
        this.actions.list(projectIds),
        this.training.list(projectIds),
        this.projects.sites(),
        this.access.allProfiles(),
        this.projects.list(),
        this.settings.current().then((s) => s.ranking.weights),
        // counts exist only for a person holding a confidential grant; for everyone else the figure is absent, not zero
        this.confidential.complaintCounts(who),
      ]);
      const sites = new Map(allSites.map((s) => [s.id, s.name]));
      const actionByObservation = new Map(actions.map((a) => [a.observationId, a]));
      const names = new Map<string, L10n>(profiles.map((p) => [p.userId, { ar: p.nameAr, en: p.nameEn }]));
      return computeAnalytics({
        from,
        to,
        today: who.today,
        reports: reports
          .filter((r) => !siteName || r.snapshot.site.en === siteName.en)
          .map((r) => ({
            id: r.id,
            ref: r.ref,
            visitId: r.visitId,
            projectId: r.projectId,
            scorePct: r.scorePct,
            date: r.snapshot.date,
            site: r.snapshot.site,
            project: r.snapshot.project.name,
            inspector: r.snapshot.inspector,
            formCode: r.snapshot.form.code,
            sections: r.snapshot.sections.map((s) => ({
              title: s.title,
              answered: s.items.filter((it) => it.answer === "c" || it.answer === "n").length,
              nonCompliant: s.items.filter((it) => it.answer === "n").length,
            })),
            guards: r.snapshot.guards.map((g) => ({ employeeNo: g.employeeNo, pct: g.pct })),
            returns: r.snapshot.decisions.filter((d) => d.action === "returned").length,
          })),
        visits: visits
          .filter((v) => !q.siteId || v.siteId === q.siteId)
          .map((v) => ({ id: v.id, ref: v.ref, projectId: v.projectId, inspectorId: v.inspectorId, date: v.date, status: v.status })),
        observations: observations
          .filter((o) => !q.siteId || o.siteId === q.siteId)
          .map((o) => ({
            id: o.id,
            ref: o.ref,
            projectId: o.projectId,
            title: o.title,
            site: sites.get(o.siteId) ?? { ar: "—", en: "—" },
            repeatCount: o.repeatCount,
            createdDate: o.createdAt.toISOString().slice(0, 10),
            itemKey: o.itemKey,
            severity: o.severity,
            hasAction: actionByObservation.has(o.id),
            actionClosed: actionByObservation.get(o.id)?.status === "closed",
          })),
        actions: actions.map((a) => ({
          id: a.id,
          ref: a.ref,
          projectId: a.projectId,
          title: a.title,
          status: a.status,
          dueDate: a.dueDate,
          createdDate: a.createdAt.toISOString().slice(0, 10),
          closedDate: a.closedAt ? a.closedAt.toISOString().slice(0, 10) : null,
        })),
        training: training.map((t) => ({
          id: t.id,
          projectId: t.projectId,
          status: t.status,
          createdDate: t.createdAt.toISOString().slice(0, 10),
          completedDate: t.completedDate,
        })),
        inspectors: names,
        projects: projectRows
          .filter((p) => !projectIds || projectIds.includes(p.id))
          .map((p) => ({ projectId: p.id, name: p.name, contractEnd: p.contractEnd, employeesAssigned: p.employeesAssigned })),
        complaints,
        rankSort: q.sort ?? "attention",
        rankWeights: weights,
      });
    });
  }

  /** A CSV (UTF-8 with BOM, so Excel opens it with Arabic intact) of the same numbers. Needs the export right. */
  async csv(q: AnalyticsQuery, who: Access): Promise<string> {
    requireCan(who, "analytics", "X");
    const r = await this.run(q, who);
    const rows: unknown[][] = [
      ["Raqib analytics", r.range.from, r.range.to],
      [],
      ["Indicator", "Value", "Unit", "Out of"],
      ...r.kpis.map((k) => [k.key, k.value ?? "", k.unit, k.of ?? ""]),
      [],
      ["Project", "Site", "Average score %", "Inspections"],
      ...r.sites.map((s) => [s.project.en, s.site.en, s.avg ?? "", s.n]),
      [],
      ["Section", "Non-compliance %", "Non-compliant", "Answered"],
      ...r.sections.map((s) => [s.title.en, s.rate, s.nonCompliant, s.answered]),
      [],
      ["Inspector", "Completed", "Missed", "Average score %", "Returned"],
      ...r.inspectors.map((x) => [x.name.en, x.done, x.missed, x.avg ?? "", x.returned]),
      [],
      ["Repeated issue", "Reference", "Site", "Times"],
      ...r.repeated.map((x) => [x.title.en, x.ref, x.site.en, x.times]),
      [],
      ["Observations", "Total", "Low", "Medium", "High", "With action", "Closed"],
      [
        "",
        r.observationSummary.total,
        r.observationSummary.bySeverity.low,
        r.observationSummary.bySeverity.medium,
        r.observationSummary.bySeverity.high,
        r.observationSummary.withAction,
        r.observationSummary.closed,
      ],
      [],
      ["Corrective-action closure", "Closed", "Average days", "Longest days"],
      ["", r.closure.n, r.closure.avgDays ?? "", r.closure.maxDays ?? ""],
      [],
      ["Recurring violation", "Site", "Times", "Last seen"],
      ...r.recurring.map((x) => [x.title.en, x.site.en, x.times, x.lastDate]),
      [],
      ["Training", "Requested", "Approved", "Completed", "Rejected", "Open", "Average days to complete"],
      ["", r.training.requested, r.training.approved, r.training.completed, r.training.rejected, r.training.open, r.training.avgDaysToComplete ?? ""],
      [],
      [
        "Rank",
        "Project",
        "Attention",
        "Observations",
        "Improvement",
        "Complaints",
        "Contract ends",
        "Days to contract end",
        "Employees assigned",
        "Average score %",
        "Inspections",
      ],
      ...r.ranking.map((x) => [
        x.rank,
        x.project.en,
        x.attention,
        x.observations,
        x.improvement ?? "",
        x.complaints ?? "",
        x.contractEnd ?? "",
        x.daysToContractEnd ?? "",
        x.employeesAssigned ?? "",
        x.avg ?? "",
        x.n,
      ]),
    ];
    return `${String.fromCharCode(0xfeff)}${rows.map((row) => row.map(csvField).join(",")).join("\r\n")}\r\n`;
  }
}
