import { daysBetween } from "@/lib/dates";
import { trackingOf, type Exercise } from "./catalog";
import type { Last, LoggedSet, Session } from "./types";

export type { Last };

/**
 * Per-exercise history derived from stored sessions. This is what closes the progression loop:
 * "last time", targets, PRs and the progress chart all come from what was actually logged.
 * Exercises never performed fall back to the catalog's baseline.
 */

export type Performance = Last & { date: string; sets: LoggedSet[] };

export type Point = { v: number; label: string; reps: number };

/** Working sets only — warm-ups say nothing about capacity. */
export const workingSets = (sets: LoggedSet[]) => sets.filter((s) => s.type !== "warmup");

/** Heaviest set, ties broken by reps. */
export function bestSet<T extends Last>(sets: T[]): T | null {
  if (sets.length === 0) return null;
  return sets.reduce((a, b) => (b.kg > a.kg || (b.kg === a.kg && b.reps > a.reps) ? b : a));
}

/** Every session in which `exId` had a working set, newest first. */
export function performances(sessions: Session[], exId: string): Performance[] {
  const out: Performance[] = [];
  for (const s of [...sessions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))) {
    const entry = s.exercises?.find((e) => e.id === exId);
    const best = entry ? bestSet(workingSets(entry.sets)) : null;
    if (entry && best) out.push({ date: s.date, kg: best.kg, reps: best.reps, sets: entry.sets });
  }
  return out;
}

/** Most recent real performance, or the catalog baseline for a never-done exercise. */
export function lastOf(sessions: Session[], ex: Exercise): Last {
  const p = performances(sessions, ex.id)[0];
  return p ? { kg: p.kg, reps: p.reps } : { kg: ex.lastKg, reps: ex.lastReps };
}

/** Whole days since `exId` was last trained (0 if never, so no "time away" adjustment). */
export function daysSinceLast(sessions: Session[], exId: string, now: Date): number {
  const p = performances(sessions, exId)[0];
  return p ? Math.max(0, daysBetween(now, new Date(p.date))) : 0;
}

/** Heaviest weight lifted for at least the bottom of the rep range (basis for a comeback). */
export function bestSuccessfulKg(sessions: Session[], ex: Exercise): number {
  const ok = performances(sessions, ex.id).filter((p) => p.reps >= ex.repLow);
  return ok.length ? Math.max(...ok.map((p) => p.kg)) : ex.workKg;
}

/** Holds, push-ups and assisted pull-ups improve in reps / seconds, not in kilos. */
export const chartsReps = (ex: Exercise) => {
  const t = trackingOf(ex);
  return t === "time" || t === "reps_only" || t === "assisted_reps";
};

/** The last `n` performances, oldest first, as chart points (kg, or reps for rep-metric lifts). */
export function seriesFor(sessions: Session[], ex: Exercise, n = 8): Point[] {
  const history = performances(sessions, ex.id).slice(0, n).reverse();
  const byReps = chartsReps(ex);
  return history.map((p, i) => ({
    label: i === history.length - 1 ? "Now" : `S${i + 1}`,
    v: byReps ? p.reps : p.kg,
    reps: p.reps,
  }));
}
