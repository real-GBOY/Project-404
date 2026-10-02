import { EXERCISES, type Exercise } from "./catalog";

type Day = { name: string; ids: string[] };

const DAYS: Record<string, Day> = {
  push: { name: "PUSH DAY", ids: ["incdb", "fly", "bench", "ohp", "tripush"] },
  pull: { name: "PULL DAY", ids: ["deadlift", "row", "latpd", "facepull", "curl"] },
  legs: { name: "LEG DAY", ids: ["squat", "rdl", "legpress", "legcurl", "calf"] },
  upper: { name: "UPPER DAY", ids: ["bench", "row", "ohp", "latpd", "curl"] },
  lower: { name: "LOWER DAY", ids: ["squat", "rdl", "legpress", "legcurl", "calf"] },
  full: { name: "FULL BODY", ids: ["squat", "bench", "row", "ohp", "curl"] },
  chest: { name: "CHEST DAY", ids: ["bench", "incdb", "fly", "ohp", "tripush"] },
  back: { name: "BACK DAY", ids: ["deadlift", "row", "latpd", "facepull", "curl"] },
  arms: { name: "ARM DAY", ids: ["curl", "tripush", "facepull", "ohp", "plank"] },
  custom: { name: "MY WORKOUT", ids: ["squat", "bench", "row", "ohp", "curl"] },
};

/** Rotation per onboarding split id (see onboarding/data.ts SPLITS). */
const ROTATION: Record<string, string[]> = {
  ppl: ["push", "pull", "legs"],
  ul: ["upper", "lower"],
  fb: ["full"],
  bro: ["chest", "back", "legs", "arms"],
  own: ["custom"],
};

/** Typical session minutes per onboarding duration id. */
const MINUTES: Record<string, number> = { d1: 40, d2: 55, d3: 75, d4: 100 };

export type DayPlan = { name: string; exercises: Exercise[]; minutes: number };

const rotationFor = (splitId: string) => ROTATION[splitId] ?? ROTATION.ppl!;

const toPlan = (day: Day, durationId: string): DayPlan => ({
  name: day.name,
  exercises: day.ids.map((id) => EXERCISES[id]!),
  minutes: MINUTES[durationId] ?? 60,
});

/** Day names in rotation order — used to seed history that ends right before "today". */
export const rotationNames = (splitId: string) => rotationFor(splitId).map((k) => DAYS[k]!.name);

export const dayByName = (name: string): Day | undefined =>
  Object.values(DAYS).find((d) => d.name === name);

/** Next day in the user's split after the most recent session (first day if none / unknown). */
export function nextPlan(splitId: string, durationId: string, lastDayName?: string): DayPlan {
  const rot = rotationFor(splitId);
  const idx = lastDayName ? rot.findIndex((k) => DAYS[k]!.name === lastDayName) : -1;
  return toPlan(DAYS[rot[(idx + 1) % rot.length]!]!, durationId);
}
