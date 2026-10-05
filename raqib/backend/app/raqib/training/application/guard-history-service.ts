import { Injectable } from "@nestjs/common";
import { readInTenant } from "@core/kernel/db/db.js";
import { Forbidden, NotFound } from "@core/kernel/errors.js";
import { can, requireProject, type Access } from "@raqib/raqib/access/access.js";
import { ProjectsRepository } from "@raqib/raqib/projects/infrastructure/projects-repository.js";
import { ReportsRepository } from "@raqib/raqib/reports/infrastructure/reports-repository.js";
import type { L10n } from "@raqib/raqib/shared/l10n.js";
import { TrainingService, type TrainingView } from "./training-service.js";

export interface GuardHistory {
  guard: { id: string; employeeNo: string; name: L10n; post: L10n };
  /** Evaluations taken from issued (frozen) reports, newest first. */
  evaluations: Array<{ reportId: string; reportRef: string; visitId: string; visitRef: string; date: string; pct: number | null; note: string; site: L10n }>;
  average: number | null;
  training: TrainingView[];
}

/** A guard's record: what inspections said about them (from issued reports) and their training. */
@Injectable()
export class GuardHistoryService {
  constructor(
    private readonly projects: ProjectsRepository,
    private readonly reports: ReportsRepository,
    private readonly training: TrainingService,
  ) {}

  /** Average score and number of evaluations per guard, for the guards list (scope-filtered, from issued reports). */
  async summaries(who: Access): Promise<Record<string, { average: number | null; evaluations: number; lastPct: number | null }>> {
    if (!can(who, "guardEval", "V") && !can(who, "training", "V")) throw Forbidden("raqib.forbidden", "Your role is not permitted to view guards.");
    const guards = await readInTenant(() => this.projects.guards(who.allProjects ? undefined : [...who.projectIds]));
    const reports = await readInTenant(() => this.reports.list(who.allProjects ? undefined : [...who.projectIds]));
    const out: Record<string, { average: number | null; evaluations: number; lastPct: number | null }> = {};
    for (const g of guards) {
      const evals = reports
        .filter((r) => r.projectId === g.projectId)
        .flatMap((r) => r.snapshot.guards.filter((x) => x.employeeNo === g.employeeNo).map((x) => ({ date: r.snapshot.date, pct: x.pct })))
        .sort((a, b) => b.date.localeCompare(a.date));
      const scored = evals.filter((e) => e.pct != null);
      out[g.id] = { average: scored.length ? Math.round(scored.reduce((s, e) => s + e.pct!, 0) / scored.length) : null, evaluations: evals.length, lastPct: scored[0]?.pct ?? null };
    }
    return out;
  }

  async of(guardId: string, who: Access): Promise<GuardHistory> {
    if (!can(who, "guardEval", "V") && !can(who, "training", "V")) throw Forbidden("raqib.forbidden", "Your role is not permitted to view guards.");
    const g = await readInTenant(() => this.projects.findGuard(guardId));
    if (!g) throw NotFound("raqib.guard_not_found", "Guard not found.");
    requireProject(who, g.projectId);
    const reports = await readInTenant(() => this.reports.list([g.projectId]));
    const evaluations = reports.flatMap((r) =>
      r.snapshot.guards
        .filter((x) => x.employeeNo === g.employeeNo)
        .map((x) => ({ reportId: r.id, reportRef: r.ref, visitId: r.visitId, visitRef: r.snapshot.visitRef, date: r.snapshot.date, pct: x.pct, note: x.note, site: r.snapshot.site })),
    );
    const scored = evaluations.filter((e) => e.pct != null);
    const training = can(who, "training", "V") ? await this.training.list(who, g.id) : [];
    return {
      guard: { id: g.id, employeeNo: g.employeeNo, name: g.name, post: g.post },
      evaluations,
      average: scored.length ? Math.round(scored.reduce((s, e) => s + e.pct!, 0) / scored.length) : null,
      training,
    };
  }
}
