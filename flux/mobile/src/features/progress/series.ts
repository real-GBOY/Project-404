import { trackingOf, type Exercise } from "./../training/catalog";
import { repRange } from "./../training/engine";

export type Point = { v: number; label: string; reps: number };

/** Holds, push-ups and assisted pull-ups improve in reps / seconds, not in kilos. */
export const chartsReps = (ex: Exercise) => {
  const t = trackingOf(ex);
  return t === "time" || t === "reps_only" || t === "assisted_reps";
};

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/**
 * 8-session working-weight history ending at the exercise's current working weight.
 * Demo data until real per-set history is aggregated: a steady climb, or a quick climb
 * followed by a flat stretch (sub-range reps) when the exercise is marked `plateau`.
 */
export function seriesFor(ex: Exercise): Point[] {
  if (chartsReps(ex)) {
    const end = ex.lastReps;
    const step = trackingOf(ex) === "time" ? 5 : 1;
    const start = Math.max(step, roundTo(end * 0.7, step));
    return ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "Now"].map((label, i) => {
      const v = i === 7 ? end : roundTo(start + ((end - start) * i) / 7, step);
      return { label, v, reps: v };
    });
  }
  const { low, high } = repRange(ex);
  const end = ex.workKg;
  const start = roundTo(end * (ex.plateau ? 0.85 : 0.69), 2.5);
  const labels = ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "Now"];
  const climbTo = ex.plateau ? 3 : 7;
  const span = Math.max(1, high - low);
  return labels.map((label, i) => {
    const t = Math.min(i, climbTo) / climbTo;
    const v = i === 7 ? end : roundTo(start + (end - start) * t, 2.5);
    // Rep counts drift through the range; a plateau stays just under the top.
    const reps = ex.plateau && i >= 5 ? high - 1 : low + ((i * 2) % span);
    return { label, v, reps: i === 7 && !ex.plateau ? ex.lastReps : reps };
  });
}
