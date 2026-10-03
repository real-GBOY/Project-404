import { addDays } from "@/lib/dates";
import { EXERCISES, STATS_PR_IDS } from "./catalog";
import { dayByName, rotationNames } from "./plan";
import type { PersonalRecord, Session } from "./types";

/** Days-ago offsets of the demo history (kept irregular so the calendar looks lived-in). */
const OFFSETS = [
  1, 3, 4, 6, 8, 9, 11, 13, 15, 16, 18, 20, 22, 23, 25, 27, 29, 31, 32, 34, 36, 38, 39, 41, 43, 45,
  46, 48, 50, 52, 53, 55, 57, 59, 60,
];

/**
 * Demo history so Home / History / Stats aren't empty before the first workout.
 * Days cycle backwards through the user's rotation, so the *next* planned day is
 * the first day of their split.
 */
export function seedSessions(splitId: string, now: Date): Session[] {
  const names = rotationNames(splitId);
  return OFFSETS.map((ago, k) => {
    const day = names[(names.length - 1 - (k % names.length) + names.length) % names.length]!;
    const first = EXERCISES[dayByName(day)!.ids[0]!]!;
    const when = addDays(now, -ago);
    when.setHours(18, 0, 0, 0);
    return {
      id: `seed-${k}`,
      day,
      date: when.toISOString(),
      volumeKg: Math.round((2.4 + ((k * 7) % 18) / 10) * 1000),
      minutes: 45 + ((k * 5) % 18),
      top: { name: first.name, kg: first.lastKg, reps: first.lastReps, deltaKg: 2.5 },
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
