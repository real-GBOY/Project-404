import { addDays } from "@/lib/dates";
import { EXERCISES, STATS_PR_IDS, type Exercise } from "./catalog";
import { categoryOf, INCREMENT } from "./engine";
import { dayByName, rotationNames } from "./plan";
import type { LoggedSet, PersonalRecord, Session, SessionExercise } from "./types";

/** Days-ago offsets of the demo history (kept irregular so the calendar looks lived-in). */
const OFFSETS = [
  1, 3, 4, 6, 8, 9, 11, 13, 15, 16, 18, 20, 22, 23, 25, 27, 29, 31, 32, 34, 36, 38, 39, 41, 43, 45,
  46, 48, 50, 52, 53, 55, 57, 59, 60,
];

/**
 * Weight used the `n`-th most recent time (0 = latest). Ends at the catalog's "last time" and
 * climbs towards it, so a user's demo history matches what the app shows. The plateau exercise
 * stays flat for its last four sessions.
 */
export function seedKg(ex: Exercise, n: number): number {
  const inc = INCREMENT[categoryOf(ex)];
  if (ex.plateau) return n < 4 ? ex.lastKg : ex.lastKg - inc * (Math.floor((n - 4) / 2) + 1);
  return ex.lastKg - inc * Math.floor(n / 2);
}

/** Reps in the same session: the latest matches the catalog; older ones drift through the range. */
export function seedReps(ex: Exercise, n: number): number {
  if (n === 0) return ex.lastReps;
  if (ex.plateau && n < 4) return ex.lastReps;
  const span = Math.max(1, ex.repHigh - ex.repLow);
  return ex.repLow + ((n * 2) % span);
}

const seedSets = (kg: number, reps: number): LoggedSet[] =>
  [0, 1, 2].map((i) => ({
    n: i + 1,
    kg,
    reps: Math.max(1, reps - i),
    rpe: 8,
    type: "normal" as const,
  }));

/**
 * Demo history so Home / History / Stats / Progress aren't empty before the first workout.
 * Days cycle backwards through the user's rotation, so the *next* planned day is the first
 * day of their split. Each session holds real per-exercise sets, in the same shape as a
 * session the user logs — so targets and charts work from history, not from fixed numbers.
 */
export function seedSessions(splitId: string, now: Date): Session[] {
  const names = rotationNames(splitId);
  const seen = new Map<string, number>(); // exercise id → how many sessions newer than this one

  return OFFSETS.map((ago, k) => {
    const day = names[(names.length - 1 - (k % names.length) + names.length) % names.length]!;
    const exercises: SessionExercise[] = [];
    let top: Session["top"] | null = null;
    let volumeKg = 0;

    for (const id of dayByName(day)!.ids) {
      const ex = EXERCISES[id]!;
      const n = seen.get(id) ?? 0;
      seen.set(id, n + 1);
      const kg = seedKg(ex, n);
      const reps = seedReps(ex, n);
      const sets = seedSets(kg, reps);
      exercises.push({ id, sets });
      volumeKg += sets.reduce((sum, s) => sum + s.kg * s.reps, 0);
      if (!top || kg > top.kg) {
        top = { name: ex.name, kg, reps, deltaKg: Math.max(0, kg - seedKg(ex, n + 1)) };
      }
    }

    const when = addDays(now, -ago);
    when.setHours(18, 0, 0, 0);
    return {
      id: `seed-${k}`,
      day,
      date: when.toISOString(),
      volumeKg: Math.round(volumeKg),
      minutes: 45 + ((k * 5) % 18),
      top: top!,
      exercises,
    };
  });
}

/** PR dates are spread over the last weeks; a couple fall inside "this week". */
export function seedPrs(now: Date): Record<string, PersonalRecord> {
  const offsets = [18, 26, 33, 40];
  const out: Record<string, PersonalRecord> = {};
  Object.values(EXERCISES)
    .filter((e) => e.prKg > 0)
    .forEach((e, i) => {
      out[e.name] = { kg: e.prKg, date: addDays(now, -(10 + ((i * 11) % 150))).toISOString() };
    });
  STATS_PR_IDS.forEach((id, i) => {
    const e = EXERCISES[id]!;
    out[e.name] = { kg: e.prKg, date: addDays(now, -offsets[i]!).toISOString() };
  });
  return out;
}
