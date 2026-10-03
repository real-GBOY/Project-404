import { startOfWeek } from "@/lib/dates";
import type { Exercise } from "./catalog";
import { trackingOf } from "./catalog";
import { shapeOf } from "./format";
import { streak as streakOf } from "./metrics";
import type { ActiveWorkout, PersonalRecord, SetDelta, SetType, Session, Summary } from "./types";

/**
 * Pure workout logic — no React, no storage. The provider in store.tsx wires these into state,
 * so everything that decides *what happens* (deltas, PRs, supersets, summary) is testable.
 */

export const REST_SECONDS = 90;

type DeltaMode = "weight" | "reps" | "time";

export const deltaMode = (ex: Exercise): DeltaMode => {
  const t = trackingOf(ex);
  return t === "time" ? "time" : t === "weight_reps" || t === "bodyweight_reps" ? "weight" : "reps";
};

export const trimKg = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** One badge per set, ranked PR > gain > matched > below. Reps/time lifts ignore the load. */
export function setDelta(
  kg: number,
  reps: number,
  prev: { kg: number; reps: number },
  pr: boolean,
  fmt: (kg: number) => string = trimKg,
  mode: DeltaMode = "weight",
): SetDelta {
  if (pr) return { label: "New PR", kind: "pr" };
  if (mode === "weight" && kg > prev.kg) {
    return { label: `+${fmt(kg - prev.kg)} kg`, kind: "up" };
  }
  const sameLoad = mode !== "weight" || kg === prev.kg;
  if (sameLoad && reps > prev.reps) {
    const n = reps - prev.reps;
    const unit = mode === "time" ? "sec" : `rep${n > 1 ? "s" : ""}`;
    return { label: `+${n} ${unit}`, kind: "up" };
  }
  if (sameLoad && reps === prev.reps) return { label: "Matched", kind: "flat" };
  return { label: "Below last time", kind: "down" };
}

/** First and last index of the superset group containing `index` (equal when not linked). */
export function groupBounds(links: Record<number, boolean>, index: number) {
  let end = index;
  while (links[end]) end++;
  let start = index;
  while (links[start - 1]) start--;
  return { start, end };
}

export function createWorkout(
  name: string,
  exercises: Exercise[],
  links: Record<number, boolean> = {},
  startedAt = Date.now(),
): ActiveWorkout {
  return {
    day: name,
    startedAt,
    exercises: exercises.map((ex) => ({ ex, sets: [] })),
    index: 0,
    links,
  };
}

export type LogOutcome = {
  workout: ActiveWorkout;
  newPR: boolean;
  previousKg: number;
  exercise: Exercise;
  /** True when the rest timer should start (always, except between superset members). */
  startRest: boolean;
};

export function applyLogSet(
  w: ActiveWorkout,
  input: { kg: number; reps: number; type: SetType },
  prs: Record<string, PersonalRecord>,
): LogOutcome {
  const { kg, reps, type } = input;
  const entry = w.exercises[w.index]!;
  const previousKg = prs[entry.ex.name]?.kg ?? entry.ex.prKg;
  // Warm-up, drop and failure sets never set a weight PR (not a clean working effort).
  const newPR = type === "normal" && shapeOf(entry.ex).weighted && kg > previousKg;
  const working = entry.sets.filter((s) => s.type !== "warmup");
  const prev = working[working.length - 1] ?? { kg: entry.ex.lastKg, reps: entry.ex.lastReps };
  const delta: SetDelta =
    type === "warmup"
      ? { label: "Warm-up", kind: "flat" }
      : setDelta(kg, reps, prev, newPR, trimKg, deltaMode(entry.ex));
  const sets = [...entry.sets, { n: entry.sets.length + 1, kg, reps, rpe: 8, type, delta }];
  const exercises = w.exercises.map((e, i) => (i === w.index ? { ...e, sets } : e));

  // Supersets rotate through the group with no rest; rest starts after the last member.
  const { start, end } = groupBounds(w.links, w.index);
  if (end > start) {
    const index = w.index < end ? w.index + 1 : start;
    return {
      workout: { ...w, exercises, index },
      newPR,
      previousKg,
      exercise: entry.ex,
      startRest: w.index === end,
    };
  }
  return { workout: { ...w, exercises }, newPR, previousKg, exercise: entry.ex, startRest: true };
}

/** Index of the exercise after the current group, or null on the last one. */
export function nextExerciseIndex(w: ActiveWorkout): number | null {
  const index = groupBounds(w.links, w.index).end + 1;
  return index >= w.exercises.length ? null : index;
}

export const moveTo = (w: ActiveWorkout, index: number): ActiveWorkout => ({ ...w, index });

/** Replaces the current exercise; `planned` keeps the original so history stays honest. */
export function swapCurrent(w: ActiveWorkout, ex: Exercise): ActiveWorkout {
  return {
    ...w,
    exercises: w.exercises.map((e, i) =>
      i === w.index ? { ...e, ex, planned: e.planned ?? e.ex } : e,
    ),
  };
}

const bestSet = (sets: { kg: number; reps: number }[]) =>
  sets.reduce((a, b) => (b.kg > a.kg || (b.kg === a.kg && b.reps > a.reps) ? b : a));

/**
 * Turns a finished workout into the session to store plus the summary to show.
 * Warm-ups never count towards volume, PRs or progress. Returns null if nothing was logged.
 */
export function finalizeWorkout(
  w: ActiveWorkout,
  ctx: {
    sessions: Session[];
    prs: Record<string, PersonalRecord>;
    now: Date;
    idSuffix?: string;
  },
): { session: Session; summary: Summary } | null {
  const logged = w.exercises
    .map((e) => ({ ...e, sets: e.sets.filter((s) => s.type !== "warmup") }))
    .filter((e) => e.sets.length > 0);
  if (logged.length === 0) return null;

  const volumeKg = logged.reduce(
    (sum, e) =>
      shapeOf(e.ex).weighted ? sum + e.sets.reduce((s, x) => s + x.kg * x.reps, 0) : sum,
    0,
  );
  const tops = logged
    .map((e) => ({ ex: e.ex, set: e.sets.reduce((a, b) => (b.kg >= a.kg ? b : a)) }))
    .sort((a, b) => b.set.kg - a.set.kg);
  const best = tops.find((t) => shapeOf(t.ex).weighted) ?? tops[0]!;

  const nowMs = ctx.now.getTime();
  const session: Session = {
    id: `s-${nowMs}${ctx.idSuffix ?? ""}`,
    day: w.day,
    date: ctx.now.toISOString(),
    volumeKg: Math.round(volumeKg),
    minutes: Math.max(1, Math.round((nowMs - w.startedAt) / 60000)),
    top: {
      name: best.ex.name,
      kg: best.set.kg,
      reps: best.set.reps,
      deltaKg: best.set.kg - best.ex.lastKg,
    },
  };

  const all = [session, ...ctx.sessions];
  const weekStart = startOfWeek(ctx.now).getTime();
  const summary: Summary = {
    day: w.day,
    minutes: session.minutes,
    exercises: logged.length,
    sets: logged.reduce((n, e) => n + e.sets.length, 0),
    volumeKg: session.volumeKg,
    progress: logged.map((e) => {
      const b = bestSet(e.sets);
      return {
        name: e.ex.name,
        delta: setDelta(
          b.kg,
          b.reps,
          { kg: e.ex.lastKg, reps: e.ex.lastReps },
          false,
          trimKg,
          deltaMode(e.ex),
        ),
      };
    }),
    prs: logged.flatMap((e) => {
      const hit = e.sets.filter((s) => s.delta?.kind === "pr");
      if (hit.length === 0) return [];
      const b = bestSet(hit);
      return [
        {
          name: e.ex.name,
          kg: b.kg,
          reps: b.reps,
          previousKg: ctx.prs[e.ex.name]?.kg ?? e.ex.prKg,
        },
      ];
    }),
    weekCount: all.filter((x) => new Date(x.date).getTime() >= weekStart).length,
    streak: streakOf(all, ctx.now),
    replaced: logged
      .filter((e) => e.planned && e.planned.id !== e.ex.id)
      .map((e) => ({ from: e.planned!.name, to: e.ex.name })),
    sessionId: session.id,
  };
  return { session, summary };
}
