export type Muscle = "Chest" | "Back" | "Shoulders" | "Arms" | "Legs" | "Core";

/** How an exercise is logged (design: FLUX-DATA-MODEL.md, Exercise.trackingType). */
export type Tracking = "weight_reps" | "bodyweight_reps" | "assisted_reps" | "time" | "reps_only";

export type Exercise = {
  /** Defaults to weight × reps. For `time`, `lastReps` / `workKg` carry seconds / nothing. */
  tracking?: Tracking;
  id: string;
  name: string;
  muscle: Muscle;
  /** kg the lifter used last session. */
  lastKg: number;
  lastReps: number;
  /** current working weight (end of the progress chart). */
  workKg: number;
  /** all-time personal record in kg, before any logging in this app. */
  prKg: number;
  /** true → the progress chart flat-lines for the last sessions (plateau banner). */
  plateau?: boolean;
};

export const EXERCISES: Record<string, Exercise> = {
  bench: {
    id: "bench",
    name: "Bench Press",
    muscle: "Chest",
    lastKg: 77.5,
    lastReps: 8,
    workKg: 80,
    prKg: 105,
    plateau: true,
  },
  incdb: {
    id: "incdb",
    name: "Incline Dumbbell Press",
    muscle: "Chest",
    lastKg: 30,
    lastReps: 10,
    workKg: 32.5,
    prKg: 40,
  },
  fly: {
    id: "fly",
    name: "Cable Fly",
    muscle: "Chest",
    lastKg: 20,
    lastReps: 12,
    workKg: 22.5,
    prKg: 30,
  },
  ohp: {
    id: "ohp",
    name: "Overhead Press",
    muscle: "Shoulders",
    lastKg: 47.5,
    lastReps: 8,
    workKg: 50,
    prKg: 65,
  },
  tripush: {
    id: "tripush",
    name: "Triceps Pushdown",
    muscle: "Arms",
    lastKg: 30,
    lastReps: 12,
    workKg: 32.5,
    prKg: 45,
  },
  deadlift: {
    id: "deadlift",
    name: "Deadlift",
    muscle: "Back",
    lastKg: 140,
    lastReps: 5,
    workKg: 142.5,
    prKg: 180,
  },
  row: {
    id: "row",
    name: "Barbell Row",
    muscle: "Back",
    lastKg: 70,
    lastReps: 8,
    workKg: 72.5,
    prKg: 90,
  },
  latpd: {
    id: "latpd",
    name: "Lat Pulldown",
    muscle: "Back",
    lastKg: 60,
    lastReps: 10,
    workKg: 62.5,
    prKg: 80,
  },
  facepull: {
    id: "facepull",
    name: "Face Pull",
    muscle: "Shoulders",
    lastKg: 25,
    lastReps: 15,
    workKg: 27.5,
    prKg: 35,
  },
  curl: {
    id: "curl",
    name: "Biceps Curl",
    muscle: "Arms",
    lastKg: 25,
    lastReps: 10,
    workKg: 27.5,
    prKg: 35,
  },
  squat: {
    id: "squat",
    name: "Squat",
    muscle: "Legs",
    lastKg: 120,
    lastReps: 6,
    workKg: 122.5,
    prKg: 150,
  },
  rdl: {
    id: "rdl",
    name: "Romanian Deadlift",
    muscle: "Legs",
    lastKg: 100,
    lastReps: 8,
    workKg: 102.5,
    prKg: 130,
  },
  legpress: {
    id: "legpress",
    name: "Leg Press",
    muscle: "Legs",
    lastKg: 200,
    lastReps: 10,
    workKg: 205,
    prKg: 260,
  },
  legcurl: {
    id: "legcurl",
    name: "Leg Curl",
    muscle: "Legs",
    lastKg: 45,
    lastReps: 12,
    workKg: 47.5,
    prKg: 60,
  },
  calf: {
    id: "calf",
    name: "Calf Raise",
    muscle: "Legs",
    lastKg: 80,
    lastReps: 15,
    workKg: 82.5,
    prKg: 110,
  },
  pullup: {
    id: "pullup",
    name: "Pull-up",
    tracking: "bodyweight_reps",
    muscle: "Back",
    lastKg: 5,
    lastReps: 8,
    workKg: 5,
    prKg: 10,
  },
  asspull: {
    id: "asspull",
    name: "Assisted Pull-up",
    tracking: "assisted_reps",
    muscle: "Back",
    lastKg: 30,
    lastReps: 8,
    workKg: 30,
    prKg: 0,
  },
  pushup: {
    id: "pushup",
    name: "Push-up",
    tracking: "reps_only",
    muscle: "Chest",
    lastKg: 0,
    lastReps: 20,
    workKg: 0,
    prKg: 0,
  },
  plankhold: {
    id: "plankhold",
    name: "Plank",
    tracking: "time",
    muscle: "Core",
    lastKg: 0,
    lastReps: 60,
    workKg: 0,
    prKg: 0,
  },
  plank: {
    id: "plank",
    name: "Weighted Crunch",
    muscle: "Core",
    lastKg: 20,
    lastReps: 15,
    workKg: 22.5,
    prKg: 35,
  },
};

export const trackingOf = (e: Exercise): Tracking => e.tracking ?? "weight_reps";

export const exerciseByName = (name: string): Exercise | undefined =>
  Object.values(EXERCISES).find((e) => e.name.toLowerCase() === name.toLowerCase());

/** Exercises shown in the profile "My PRs" card, in the design's order. */
export const PROFILE_PR_IDS = ["bench", "deadlift", "squat"] as const;
/** Exercises shown in the Stats "Personal records" card, in the design's order. */
export const STATS_PR_IDS = ["deadlift", "squat", "bench", "ohp"] as const;
