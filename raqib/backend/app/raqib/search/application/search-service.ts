import { Injectable } from "@nestjs/common";
import { ActionsService } from "@raqib/raqib/actions/application/actions-service.js";
import type { Access } from "@raqib/raqib/access/access.js";
import { ObservationsService } from "@raqib/raqib/observations/application/observations-service.js";
import { PeopleService } from "@raqib/raqib/people/application/people-service.js";
import { ProjectsService } from "@raqib/raqib/projects/application/projects-service.js";
import { ReportsService } from "@raqib/raqib/reports/application/reports-service.js";
import type { L10n } from "@raqib/raqib/shared/l10n.js";
import { TrainingService } from "@raqib/raqib/training/application/training-service.js";
import { VisitsService } from "@raqib/raqib/visits/application/visits-service.js";

export type SearchKind = "project" | "visit" | "report" | "observation" | "action" | "training" | "guard" | "user";
export interface SearchHit {
  kind: SearchKind;
  id: string;
  ref: string;
  title: L10n | string;
  sub: string;
  /** Route name and id the web app opens. */
  go: [string, string];
}

const MAX_PER_KIND = 5;
const norm = (s: unknown): string => String(s ?? "").toLowerCase();

/**
 * Search across what the caller may already read. It composes the modules' own scope- and permission-checked
 * lists, so a person never finds a record they could not open, and the confidential area is not a source at all.
 */
@Injectable()
export class SearchService {
  constructor(
    private readonly projects: ProjectsService,
    private readonly visits: VisitsService,
    private readonly reports: ReportsService,
    private readonly observations: ObservationsService,
    private readonly actions: ActionsService,
    private readonly training: TrainingService,
    private readonly people: PeopleService,
  ) {}

  async run(q: string, who: Access): Promise<SearchHit[]> {
    const needle = norm(q.trim());
    if (needle.length < 2) return [];
    const match = (...fields: unknown[]): boolean => fields.some((f) => (typeof f === "object" && f ? Object.values(f as object) : [f]).some((x) => norm(x).includes(needle)));
    // each source silently contributes nothing when the person lacks the permission for it
    const safe = async <T,>(fn: () => Promise<T[]>): Promise<T[]> => fn().catch(() => []);
    const [projects, guards, visits, reports, observations, actions, training, users] = await Promise.all([
      safe(() => this.projects.list(who)),
      safe(() => this.projects.guards(who)),
      safe(() => this.visits.list(who)),
      safe(() => this.reports.list(who)),
      safe(() => this.observations.list(who)),
      safe(() => this.actions.list(who)),
      safe(() => this.training.list(who)),
      safe(() => this.people.list(who)),
    ]);
    const top = <T,>(xs: T[], pred: (x: T) => boolean): T[] => xs.filter(pred).slice(0, MAX_PER_KIND);
    const hits: SearchHit[] = [
      ...top(projects, (p) => match(p.code, p.name, p.city)).map((p) => ({ kind: "project" as const, id: p.id, ref: p.code, title: p.name, sub: "", go: ["project", p.id] as [string, string] })),
      ...top(visits, (v) => match(v.ref, v.project.name, v.site.name)).map((v) => ({ kind: "visit" as const, id: v.id, ref: v.ref, title: v.site.name, sub: v.project.code, go: ["visit", v.id] as [string, string] })),
      ...top(reports, (r) => match(r.ref, r.snapshot.visitRef, r.snapshot.project.name, r.snapshot.site)).map((r) => ({ kind: "report" as const, id: r.id, ref: r.ref, title: r.snapshot.site, sub: r.snapshot.project.code, go: ["report", r.visitId] as [string, string] })),
      ...top(observations, (o) => match(o.ref, o.title, o.site)).map((o) => ({ kind: "observation" as const, id: o.id, ref: o.ref, title: o.title, sub: o.project.code, go: ["observations", ""] as [string, string] })),
      ...top(actions, (a) => match(a.ref, a.title, a.description)).map((a) => ({ kind: "action" as const, id: a.id, ref: a.ref, title: a.title, sub: a.project.code, go: ["action", a.id] as [string, string] })),
      ...top(training, (t) => match(t.ref, t.course, t.guard.name, t.guard.employeeNo)).map((t) => ({ kind: "training" as const, id: t.id, ref: t.ref, title: t.course, sub: t.guard.employeeNo, go: ["trainingD", t.id] as [string, string] })),
      ...top(guards, (g) => match(g.employeeNo, g.name)).map((g) => ({ kind: "guard" as const, id: g.id, ref: g.employeeNo, title: g.name, sub: "", go: ["guard", g.id] as [string, string] })),
      ...top(users, (u) => match(u.name, u.email)).map((u) => ({ kind: "user" as const, id: u.id, ref: "", title: u.name, sub: u.role, go: ["user", u.id] as [string, string] })),
    ];
    return hits;
  }
}
