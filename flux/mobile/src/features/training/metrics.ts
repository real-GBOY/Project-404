import { addDays, daysBetween, isSameDay, startOfDay, startOfWeek } from "@/lib/dates";
import type { Muscle } from "./catalog";
import { EXERCISES } from "./catalog";
import { dayByName } from "./plan";
import type { PersonalRecord, Session } from "./types";

const dateOf = (s: Session) => new Date(s.date);

export const trainedOn = (sessions: Session[], day: Date) =>
  sessions.some((s) => isSameDay(dateOf(s), day));

/** Consecutive trained days, counted back from today (or from yesterday if today isn't done yet). */
export function streak(sessions: Session[], now: Date): number {
  let cursor = startOfDay(now);
  if (!trainedOn(sessions, cursor)) cursor = addDays(cursor, -1);
  let n = 0;
  while (trainedOn(sessions, cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

const inWeek = (d: Date, now: Date) => {
  const diff = daysBetween(d, startOfWeek(now));
  return diff >= 0 && diff < 7;
};

export const weekVolumeKg = (sessions: Session[], now: Date) =>
  sessions.filter((s) => inWeek(dateOf(s), now)).reduce((sum, s) => sum + s.volumeKg, 0);

export const prsThisWeek = (prs: Record<string, PersonalRecord>, now: Date) =>
  Object.values(prs).filter((p) => inWeek(new Date(p.date), now)).length;

const sameMonth = (a: Date, y: number, m: number) => a.getFullYear() === y && a.getMonth() === m;

export function monthStats(sessions: Session[], y: number, m: number) {
  const inMonth = sessions.filter((s) => sameMonth(dateOf(s), y, m));
  return {
    sessions: inMonth.length,
    volumeKg: inMonth.reduce((sum, s) => sum + s.volumeKg, 0),
  };
}

export function monthPrCount(prs: Record<string, PersonalRecord>, y: number, m: number) {
  return Object.values(prs).filter((p) => sameMonth(new Date(p.date), y, m)).length;
}

/** Tonnes lifted per day Mon..Sun for the week containing `now`. */
export function weekTonnes(sessions: Session[], now: Date): number[] {
  const start = startOfWeek(now);
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(start, i);
    const kg = sessions
      .filter((s) => isSameDay(dateOf(s), day))
      .reduce((sum, s) => sum + s.volumeKg, 0);
    return Math.round(kg / 100) / 10;
  });
}

const MUSCLES: Muscle[] = ["Chest", "Back", "Shoulders", "Arms", "Legs", "Core"];

/** Sets per muscle over the last 7 days (each planned exercise counts as 4 working sets). */
export function muscleSets(sessions: Session[], now: Date): { muscle: Muscle; sets: number }[] {
  const counts = new Map<Muscle, number>(MUSCLES.map((m) => [m, 0]));
  for (const s of sessions) {
    if (daysBetween(now, dateOf(s)) > 6 || daysBetween(now, dateOf(s)) < 0) continue;
    for (const id of dayByName(s.day)?.ids ?? []) {
      const muscle = EXERCISES[id]!.muscle;
      counts.set(muscle, (counts.get(muscle) ?? 0) + 4);
    }
  }
  return MUSCLES.map((muscle) => ({ muscle, sets: counts.get(muscle) ?? 0 }));
}

/** Total kg lifted in the window [fromDaysAgo, toDaysAgo) counted back from `now` (0 = today). */
export function volumeInWindow(
  sessions: Session[],
  now: Date,
  fromDaysAgo: number,
  toDaysAgo: number,
) {
  return sessions
    .filter((s) => {
      const ago = daysBetween(now, dateOf(s));
      return ago >= fromDaysAgo && ago < toDaysAgo;
    })
    .reduce((sum, s) => sum + s.volumeKg, 0);
}
