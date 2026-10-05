import type { L10n } from "@raqib/raqib/shared/l10n.js";

/**
 * Analytics computed from persisted data — issued report snapshots, visits, observations and corrective actions —
 * by pure functions, so every number can be explained, drilled into and tested. Nothing here reads a database.
 */
export interface AReport { id: string; ref: string; visitId: string; projectId: string; scorePct: number | null; date: string; site: L10n; project: L10n; inspector: L10n | null; formCode: string; sections: Array<{ title: L10n; answered: number; nonCompliant: number }>; guards: Array<{ employeeNo: string; pct: number | null }>; returns: number }
export interface AVisit { id: string; ref: string; projectId: string; inspectorId: string | null; date: string; status: string }
export interface AObservation { id: string; ref: string; projectId: string; title: L10n; site: L10n; repeatCount: number; createdDate: string }
export interface AAction { id: string; ref: string; projectId: string; title: L10n; status: string; dueDate: string }

export interface AnalyticsInput {
  from: string;
  to: string;
  today: string;
  reports: AReport[];
  visits: AVisit[];
  observations: AObservation[];
  actions: AAction[];
  /** Inspector id -> name, for the activity table. */
  inspectors: Map<string, L10n>;
  /** Visit id -> report, to join visits with their outcome. */
}

export interface Contributor { kind: "report" | "visit" | "observation" | "action"; id: string; ref: string; title: L10n | string; sub: string; value: string }
export interface Kpi { key: string; value: number | null; unit: "pct" | "count"; of?: number; contributors: Contributor[] }

export interface AnalyticsResult {
  range: { from: string; to: string; bucket: "day" | "week" | "month" };
  kpis: Kpi[];
  trend: Array<{ label: string; avg: number | null; n: number }>;
  sections: Array<{ title: L10n; rate: number; nonCompliant: number; answered: number }>;
  sites: Array<{ project: L10n; site: L10n; avg: number | null; n: number }>;
  actionStages: Array<{ stage: string; n: number }>;
  guardBuckets: Array<{ bucket: "low" | "mid" | "high"; n: number }>;
  inspectors: Array<{ id: string; name: L10n; done: number; missed: number; avg: number | null; returned: number }>;
  repeated: Array<{ ref: string; id: string; title: L10n; site: L10n; times: number }>;
}

const inRange = (d: string, from: string, to: string): boolean => d >= from && d <= to;
const mean = (xs: number[]): number | null => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export const addDaysIso = (d: string, n: number): string => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Daily buckets for up to a month, weekly up to four months, monthly beyond. */
export function bucketFor(from: string, to: string): "day" | "week" | "month" {
  const span = daysBetween(from, to) + 1;
  return span <= 31 ? "day" : span <= 120 ? "week" : "month";
}

function bucketKey(date: string, bucket: "day" | "week" | "month"): string {
  if (bucket === "day") return date;
  if (bucket === "month") return date.slice(0, 7);
  const dt = new Date(`${date}T00:00:00Z`);
  const monday = new Date(dt.getTime() - ((dt.getUTCDay() + 6) % 7) * 86_400_000);
  return monday.toISOString().slice(0, 10);
}

/** Visits that were due but never started count as missed (not yet due, or already worked, do not). */
const isMissed = (v: AVisit, today: string): boolean => (v.status === "scheduled" || v.status === "assigned") && v.date < today;
const isExecuted = (v: AVisit): boolean => !["scheduled", "assigned", "cancelled"].includes(v.status);

export function computeAnalytics(i: AnalyticsInput): AnalyticsResult {
  const bucket = bucketFor(i.from, i.to);
  const reports = i.reports.filter((r) => inRange(r.date, i.from, i.to));
  const visits = i.visits.filter((v) => inRange(v.date, i.from, i.to) && v.status !== "cancelled");
  const scored = reports.filter((r) => r.scorePct != null);

  const executed = visits.filter(isExecuted);
  const missed = visits.filter((v) => isMissed(v, i.today));
  const observations = i.observations.filter((o) => inRange(o.createdDate, i.from, i.to));
  const repeats = observations.filter((o) => o.repeatCount > 0);
  const openActions = i.actions.filter((a) => a.status !== "closed");
  const overdueActions = openActions.filter((a) => ["assigned", "in_progress", "returned"].includes(a.status) && a.dueDate < i.today);
  const guardPcts = reports.flatMap((r) => r.guards.map((g) => g.pct).filter((p): p is number => p != null));

  const contributorOfReport = (r: AReport): Contributor => ({ kind: "report", id: r.visitId, ref: r.ref, title: r.site, sub: `${r.date}`, value: r.scorePct == null ? "—" : `${r.scorePct}%` });
  const kpis: Kpi[] = [
    { key: "compliance", value: mean(scored.map((r) => r.scorePct!)), unit: "pct", contributors: scored.map(contributorOfReport) },
    { key: "inspections", value: reports.length, unit: "count", contributors: reports.map(contributorOfReport) },
    {
      key: "execution", value: visits.length ? Math.round((executed.length / visits.length) * 100) : null, unit: "pct", of: visits.length,
      contributors: visits.map((v) => ({ kind: "visit", id: v.id, ref: v.ref, title: v.ref, sub: v.date, value: v.status })),
    },
    { key: "missed", value: missed.length, unit: "count", contributors: missed.map((v) => ({ kind: "visit", id: v.id, ref: v.ref, title: v.ref, sub: v.date, value: v.status })) },
    { key: "repeats", value: repeats.length, unit: "count", contributors: repeats.map((o) => ({ kind: "observation", id: o.id, ref: o.ref, title: o.title, sub: o.site.en, value: `×${o.repeatCount + 1}` })) },
    { key: "overdueActions", value: overdueActions.length, unit: "count", of: openActions.length, contributors: overdueActions.map((a) => ({ kind: "action", id: a.id, ref: a.ref, title: a.title, sub: a.dueDate, value: a.status })) },
    { key: "guardAvg", value: mean(guardPcts), unit: "pct", contributors: [] },
  ];

  const buckets = new Map<string, number[]>();
  for (const r of scored) {
    const k = bucketKey(r.date, bucket);
    buckets.set(k, [...(buckets.get(k) ?? []), r.scorePct!]);
  }
  const trend = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, xs]) => ({ label, avg: mean(xs), n: xs.length }));

  const secMap = new Map<string, { title: L10n; answered: number; nc: number }>();
  for (const r of reports) for (const s of r.sections) {
    const cur = secMap.get(s.title.en) ?? { title: s.title, answered: 0, nc: 0 };
    cur.answered += s.answered;
    cur.nc += s.nonCompliant;
    secMap.set(s.title.en, cur);
  }
  const sections = [...secMap.values()].map((s) => ({ title: s.title, rate: s.answered ? Math.round((s.nc / s.answered) * 100) : 0, nonCompliant: s.nc, answered: s.answered })).sort((a, b) => b.rate - a.rate);

  const siteMap = new Map<string, { project: L10n; site: L10n; xs: number[]; n: number }>();
  for (const r of reports) {
    const k = `${r.projectId}|${r.site.en}`;
    const cur = siteMap.get(k) ?? { project: r.project, site: r.site, xs: [], n: 0 };
    cur.n += 1;
    if (r.scorePct != null) cur.xs.push(r.scorePct);
    siteMap.set(k, cur);
  }
  const sites = [...siteMap.values()].map((s) => ({ project: s.project, site: s.site, avg: mean(s.xs), n: s.n })).sort((a, b) => (a.avg ?? 101) - (b.avg ?? 101));

  const stageOf = (a: AAction): string => (["assigned", "in_progress", "returned"].includes(a.status) && a.dueDate < i.today ? "overdue" : a.status);
  const stages = ["assigned", "in_progress", "quality_review", "returned", "closed", "overdue"];
  const actionStages = stages.map((stage) => ({ stage, n: i.actions.filter((a) => stageOf(a) === stage).length }));

  const guardBuckets = [
    { bucket: "low" as const, n: guardPcts.filter((p) => p < 60).length },
    { bucket: "mid" as const, n: guardPcts.filter((p) => p >= 60 && p < 80).length },
    { bucket: "high" as const, n: guardPcts.filter((p) => p >= 80).length },
  ];

  const byVisit = new Map(reports.map((r) => [r.visitId, r]));
  const inspectors = [...new Set(visits.map((v) => v.inspectorId).filter((x): x is string => !!x))].map((id) => {
    const mine = visits.filter((v) => v.inspectorId === id);
    const done = mine.map((v) => byVisit.get(v.id)).filter((r): r is AReport => !!r);
    return {
      id, name: i.inspectors.get(id) ?? { ar: "—", en: "—" }, done: done.length, missed: mine.filter((v) => isMissed(v, i.today)).length,
      avg: mean(done.filter((r) => r.scorePct != null).map((r) => r.scorePct!)), returned: done.reduce((s, r) => s + r.returns, 0),
    };
  }).sort((a, b) => b.done - a.done);

  const repeated = repeats.slice().sort((a, b) => b.repeatCount - a.repeatCount).slice(0, 8).map((o) => ({ ref: o.ref, id: o.id, title: o.title, site: o.site, times: o.repeatCount + 1 }));

  return { range: { from: i.from, to: i.to, bucket }, kpis, trend, sections, sites, actionStages, guardBuckets, inspectors, repeated };
}
