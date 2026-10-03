import { trackingOf, type Exercise } from "@/features/training/catalog";
import { isPlateau, repRange, trendOf, type Trend } from "@/features/training/engine";
import type { PersonalRecord } from "@/features/training/types";
import { chartsReps, seriesFor, type Point } from "./series";

export type Progress = {
  data: Point[];
  started: number;
  current: number;
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
};

/** Everything the exercise-progress screen shows, derived from the (demo) history. */
export function analyzeProgress(ex: Exercise, prs: Record<string, PersonalRecord>): Progress {
  const data = seriesFor(ex);
  const started = data[0]!.v;
  const current = data[data.length - 1]!.v;
  const repsMetric = chartsReps(ex);
  return {
    data,
    started,
    current,
    gainPct: started ? Math.round(((current - started) / started) * 100) : 0,
    repsMetric,
    repsUnit: trackingOf(ex) === "time" ? "SEC" : "REPS",
    trend: trendOf(data.map((d) => d.v)),
    plateau: isPlateau(
      data.map((d) => ({ kg: d.v, reps: d.reps })),
      repRange(ex).high,
    ),
    best: repsMetric ? Math.max(...data.map((d) => d.v)) : (prs[ex.name]?.kg ?? ex.prKg),
  };
}
