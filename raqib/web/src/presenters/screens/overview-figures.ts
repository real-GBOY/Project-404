import type { CorrectiveAction, Observation, Report, Visit } from "@/api/types";

export type Period = "week" | "month" | "quarter";
export const PERIOD_DAYS: Record<Period, number> = { week: 7, month: 30, quarter: 90 };

/** An ISO date moved by whole days (UTC, so there is no daylight-saving drift). */
export function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole-percent mean, or null when there is nothing to average. */
export const mean = (xs: number[]): number | null =>
  xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;

const scored = (r: Report): number | null => r.scorePct;
const inRange = (r: Report, from: string, to: string) =>
  r.snapshot.date >= from && r.snapshot.date <= to;

export interface Compliance {
  /** Average score of approved inspections in the period, and in the period before it. */
  overall: number | null;
  previous: number | null;
  count: number;
  byProject: Map<string, { score: number | null; previous: number | null }>;
}

/** Compliance for the `days` ending today, against the same number of days before. Only approved (issued) reports count. */
export function compliance(reports: Report[], today: string, days: number): Compliance {
  const from = shiftDate(today, -(days - 1));
  const prevTo = shiftDate(from, -1);
  const prevFrom = shiftDate(prevTo, -(days - 1));
  const cur = reports.filter((r) => inRange(r, from, today));
  const prev = reports.filter((r) => inRange(r, prevFrom, prevTo));
  const avg = (rs: Report[]) => mean(rs.map(scored).filter((x): x is number => x != null));
  const byProject = new Map<string, { score: number | null; previous: number | null }>();
  for (const id of new Set(reports.map((r) => r.projectId))) {
    byProject.set(id, {
      score: avg(cur.filter((r) => r.projectId === id)),
      previous: avg(prev.filter((r) => r.projectId === id)),
    });
  }
  return { overall: avg(cur), previous: avg(prev), count: cur.length, byProject };
}

/** Weekly averages for the last `weeks` weeks, oldest first (the little bar chart beside the headline number). */
export function weeklyAverages(
  reports: Report[],
  today: string,
  weeks = 12,
): Array<{ from: string; avg: number | null; n: number }> {
  return Array.from({ length: weeks }, (_, k) => {
    const to = shiftDate(today, -7 * (weeks - 1 - k));
    const from = shiftDate(to, -6);
    const rs = reports.filter((r) => inRange(r, from, to));
    return { from, avg: mean(rs.map(scored).filter((x): x is number => x != null)), n: rs.length };
  });
}

/** Observations still being dealt with: no corrective action yet, or one that is not closed. */
export const isOpen = (o: Observation): boolean => !o.action || o.action.status !== "closed";

export const overdueActions = (actions: CorrectiveAction[]): CorrectiveAction[] =>
  actions.filter((a) => a.status === "overdue");

/** The corrective-action pipeline: how many are at each stage (a late action stays at the stage it is really in). */
export function pipeline(actions: CorrectiveAction[]): Array<{
  stage: "assigned" | "in_progress" | "under_review" | "returned" | "closed";
  n: number;
  overdue: number;
}> {
  const stageOf = (a: CorrectiveAction) =>
    a.storedStatus === "quality_review" ? "under_review" : a.storedStatus;
  return (["assigned", "in_progress", "under_review", "returned", "closed"] as const).map(
    (stage) => {
      const here = actions.filter((a) => stageOf(a) === stage);
      return { stage, n: here.length, overdue: here.filter((a) => a.status === "overdue").length };
    },
  );
}

/** The most recent workflow events across visits, newest first. */
export function recentEvents(
  visits: Visit[],
  limit = 8,
): Array<{ visit: Visit; entry: Visit["history"][number] }> {
  return visits
    .flatMap((visit) => visit.history.map((entry) => ({ visit, entry })))
    .sort((a, b) => b.entry.at.localeCompare(a.entry.at))
    .slice(0, limit);
}

/** The next scheduled visit date on or after today for a project, if any. */
export function nextVisitDate(visits: Visit[], projectId: string, today: string): string | null {
  const dates = visits
    .filter(
      (v) =>
        v.project.id === projectId &&
        ["scheduled", "assigned"].includes(v.status) &&
        v.date >= today,
    )
    .map((v) => v.date);
  return dates.length ? dates.sort()[0]! : null;
}
