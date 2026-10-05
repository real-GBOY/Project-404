import { Injectable } from "@nestjs/common";
import { readInTenant } from "@core/kernel/db/db.js";
import { ValidationError } from "@core/kernel/errors.js";
import { requireCan, requireProject, type Access } from "@raqib/raqib/access/access.js";
import { ActionsRepository } from "@raqib/raqib/actions/infrastructure/actions-repository.js";
import { ObservationsRepository } from "@raqib/raqib/observations/infrastructure/observations-repository.js";
import { AccessRepository } from "@raqib/raqib/access/infrastructure/access-repository.js";
import { ProjectsRepository } from "@raqib/raqib/projects/infrastructure/projects-repository.js";
import { ReportsRepository } from "@raqib/raqib/reports/infrastructure/reports-repository.js";
import { VisitsRepository } from "@raqib/raqib/visits/infrastructure/visits-repository.js";
import type { L10n } from "@raqib/raqib/shared/l10n.js";
import { addDaysIso, computeAnalytics, type AnalyticsResult } from "../domain/analytics.js";

export type Period = "week" | "month" | "quarter" | "year" | "custom";
export interface AnalyticsQuery { period: Period; from?: string; to?: string; projectId?: string; siteId?: string }

const SPAN: Record<Exclude<Period, "custom">, number> = { week: 7, month: 30, quarter: 90, year: 365 };

/** Quote a CSV field, and neutralize spreadsheet formula injection by prefixing a quote. */
export function csvField(v: unknown): string {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Analytics over what the caller may see: the project scope is applied before any number is computed. */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly reports: ReportsRepository,
    private readonly visits: VisitsRepository,
    private readonly observations: ObservationsRepository,
    private readonly actions: ActionsRepository,
    private readonly projects: ProjectsRepository,
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
      const [reports, visits, observations, actions, allSites, profiles] = await Promise.all([
        this.reports.list(projectIds),
        this.visits.list({ projectIds, from, to }),
        this.observations.list(projectIds),
        this.actions.list(projectIds),
        this.projects.sites(),
        this.access.allProfiles(),
      ]);
      const sites = new Map(allSites.map((s) => [s.id, s.name]));
      const names = new Map<string, L10n>(profiles.map((p) => [p.userId, { ar: p.nameAr, en: p.nameEn }]));
      return computeAnalytics({
        from, to, today: who.today,
        reports: reports
          .filter((r) => !siteName || r.snapshot.site.en === siteName.en)
          .map((r) => ({
            id: r.id, ref: r.ref, visitId: r.visitId, projectId: r.projectId, scorePct: r.scorePct, date: r.snapshot.date, site: r.snapshot.site, project: r.snapshot.project.name,
            inspector: r.snapshot.inspector, formCode: r.snapshot.form.code,
            sections: r.snapshot.sections.map((s) => ({
              title: s.title,
              answered: s.items.filter((it) => it.answer === "c" || it.answer === "n").length,
              nonCompliant: s.items.filter((it) => it.answer === "n").length,
            })),
            guards: r.snapshot.guards.map((g) => ({ employeeNo: g.employeeNo, pct: g.pct })),
            returns: r.snapshot.decisions.filter((d) => d.action === "returned").length,
          })),
        visits: visits.filter((v) => !q.siteId || v.siteId === q.siteId).map((v) => ({ id: v.id, ref: v.ref, projectId: v.projectId, inspectorId: v.inspectorId, date: v.date, status: v.status })),
        observations: observations
          .filter((o) => !q.siteId || o.siteId === q.siteId)
          .map((o) => ({ id: o.id, ref: o.ref, projectId: o.projectId, title: o.title, site: sites.get(o.siteId) ?? { ar: "—", en: "—" }, repeatCount: o.repeatCount, createdDate: o.createdAt.toISOString().slice(0, 10) })),
        actions: actions.map((a) => ({ id: a.id, ref: a.ref, projectId: a.projectId, title: a.title, status: a.status, dueDate: a.dueDate })),
        inspectors: names,
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
    ];
    return `${String.fromCharCode(0xfeff)}${rows.map((row) => row.map(csvField).join(",")).join("\r\n")}\r\n`;
  }
}
