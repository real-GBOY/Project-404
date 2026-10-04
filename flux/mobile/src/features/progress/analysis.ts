import type { Exercise } from "@/features/training/catalog";
import { isPlateau, repRange, trendOf, type Trend } from "@/features/training/engine";
import { chartsReps, performances, seriesFor, type Point } from "@/features/training/history";
import type { PersonalRecord, Session } from "@/features/training/types";

export type Progress = {
  /** The last (up to 8) performances, oldest first. Empty until the exercise has been logged. */
  data: Point[];
  /** True once there are enough points to draw a chart and compare started vs current. */
  hasHistory: boolean;
  started: number;
  current: number;
  /** Reps at the latest performance. */
  currentReps: number;
  /** Whole-percent change from the first to the latest point. */
  gainPct: number;
  /** Holds, push-ups and assisted pull-ups are charted in reps / seconds, not kg. */
  repsMetric: boolean;
  /** Unit shown next to values when `repsMetric` (otherwise the user's weight unit is used). */
  repsUnit: "SEC" | "REPS";
  trend: Trend;
  plateau: boolean;
  /** Best value: PR kg, or the best reps / seconds for rep-metric lifts. */
  best: number;
  bestReps: number;
};

/** Everything the exercise-progress screen shows, derived from the user's logged sessions. */
export function analyzeProgress(
  ex: Exercise,
  prs: Record<string, PersonalRecord>,
  sessions: Session[],
): Progress {
  const data = seriesFor(sessions, ex);
  const all = performances(sessions, ex.id);
  const repsMetric = chartsReps(ex);
  const latest = data[data.length - 1];
  const started = data[0]?.v ?? 0;
  const current = latest?.v ?? 0;

  const heaviest = all.reduce<(typeof all)[number] | null>(
    (a, b) => (!a || b.kg > a.kg ? b : a),
    null,
  );
  const bestFromHistory = repsMetric ? Math.max(0, ...all.map((p) => p.reps)) : (heaviest?.kg ?? 0);
  const storedPr = repsMetric ? 0 : (prs[ex.name]?.kg ?? ex.prKg);

  return {
    data,
    hasHistory: data.length >= 2,
    started,
    current,
    currentReps: latest?.reps ?? 0,
    gainPct: started ? Math.round(((current - started) / started) * 100) : 0,
    repsMetric,
    repsUnit: ex.tracking === "time" ? "SEC" : "REPS",
    trend: trendOf(data.map((d) => d.v)),
    plateau: isPlateau(
      data.map((d) => ({ kg: d.v, reps: d.reps })),
      repRange(ex).high,
    ),
    best: Math.max(bestFromHistory, storedPr),
    bestReps: repsMetric ? bestFromHistory : (heaviest?.reps ?? 0),
  };
}
