import type { Exercise } from "./../training/catalog";

export type Point = { v: number; label: string };

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/**
 * 8-week working-weight history ending at the exercise's current working weight.
 * Demo data until real per-set history is aggregated: a steady climb, flat for the
 * last stretch when the exercise is marked `plateau`.
 */
export function seriesFor(ex: Exercise): Point[] {
  const end = ex.workKg;
  const start = roundTo(end * 0.69, 2.5);
  const labels = ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "Now"];
  return labels.map((label, i) => {
    const climbTo = ex.plateau ? 5 : 7;
    const t = Math.min(i, climbTo) / climbTo;
    return { label, v: i === 7 ? end : roundTo(start + (end - start) * t, 2.5) };
  });
}

/** Number of trailing points equal to the current weight (≥3 → plateau banner). */
export function plateauLength(points: Point[]): number {
  const last = points[points.length - 1]!.v;
  let n = 0;
  for (let i = points.length - 1; i >= 0 && points[i]!.v === last; i--) n++;
  return n;
}
