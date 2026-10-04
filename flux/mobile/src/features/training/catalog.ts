export type Muscle = "Chest" | "Back" | "Shoulders" | "Arms" | "Legs" | "Core";

/** How an exercise is logged (design: FLUX-DATA-MODEL.md, Exercise.trackingType). */
export type Tracking = "weight_reps" | "bodyweight_reps" | "assisted_reps" | "time" | "reps_only";

export type Equipment = "Barbell" | "Dumbbell" | "Cable" | "Machine" | "Bodyweight";

export type Exercise = {
  /** Defaults to weight × reps. For `time`, `lastReps` / `workKg` carry seconds / nothing. */
  tracking?: Tracking;
  id: string;
  name: string;
  equipment: Equipment;
  /** Target rep range used by the progression engine. */
  repLow: number;
  repHigh: number;
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
    equipment: "Barbell",
    repLow: 6,
    repHigh: 8,
    name: "Bench Press",
    muscle: "Chest",
    lastKg: 77.5,
    lastReps: 7,
    workKg: 80,
    prKg: 105,
    plateau: true,
  },
  incdb: {
    id: "incdb",
    equipment: "Dumbbell",
    repLow: 8,
    repHigh: 12,
    name: "Incline Dumbbell Press",
    muscle: "Chest",
    lastKg: 30,
    lastReps: 10,
    workKg: 32.5,
    prKg: 40,
  },
  fly: {
    id: "fly",
    equipment: "Cable",
    repLow: 10,
    repHigh: 12,
    name: "Cable Fly",
    muscle: "Chest",
    lastKg: 20,
    lastReps: 12,
    workKg: 22.5,
    prKg: 30,
  },
  ohp: {
    id: "ohp",
    equipment: "Barbell",
    repLow: 6,
    repHigh: 8,
    name: "Overhead Press",
    muscle: "Shoulders",
    lastKg: 47.5,
    lastReps: 8,
    workKg: 50,
    prKg: 65,
  },
  tripush: {
    id: "tripush",
    equipment: "Cable",
    repLow: 8,
    repHigh: 12,
    name: "Triceps Pushdown",
    muscle: "Arms",
    lastKg: 30,
    lastReps: 12,
    workKg: 32.5,
    prKg: 45,
  },
  deadlift: {
    id: "deadlift",
    equipment: "Barbell",
    repLow: 3,
    repHigh: 5,
    name: "Deadlift",
    muscle: "Back",
    lastKg: 140,
    lastReps: 5,
    workKg: 142.5,
    prKg: 180,
  },
  row: {
    id: "row",
    equipment: "Barbell",
    repLow: 6,
    repHigh: 8,
    name: "Barbell Row",
    muscle: "Back",
    lastKg: 70,
    lastReps: 8,
    workKg: 72.5,
    prKg: 90,
  },
  latpd: {
    id: "latpd",
    equipment: "Cable",
    repLow: 8,
    repHigh: 12,
    name: "Lat Pulldown",
    muscle: "Back",
    lastKg: 60,
    lastReps: 10,
    workKg: 62.5,
    prKg: 80,
  },
  facepull: {
    id: "facepull",
    equipment: "Cable",
    repLow: 12,
    repHigh: 15,
    name: "Face Pull",
    muscle: "Shoulders",
    lastKg: 25,
    lastReps: 15,
    workKg: 27.5,
    prKg: 35,
  },
  curl: {
    id: "curl",
    equipment: "Dumbbell",
    repLow: 8,
    repHigh: 12,
    name: "Biceps Curl",
    muscle: "Arms",
    lastKg: 25,
    lastReps: 10,
    workKg: 27.5,
    prKg: 35,
  },
  squat: {
    id: "squat",
    equipment: "Barbell",
    repLow: 5,
    repHigh: 8,
    name: "Squat",
    muscle: "Legs",
    lastKg: 120,
    lastReps: 6,
    workKg: 122.5,
    prKg: 150,
  },
  rdl: {
    id: "rdl",
    equipment: "Barbell",
    repLow: 6,
    repHigh: 8,
    name: "Romanian Deadlift",
    muscle: "Legs",
    lastKg: 100,
    lastReps: 8,
    workKg: 102.5,
    prKg: 130,
  },
  legpress: {
    id: "legpress",
    equipment: "Machine",
    repLow: 8,
    repHigh: 12,
    name: "Leg Press",
    muscle: "Legs",
    lastKg: 200,
    lastReps: 10,
    workKg: 205,
    prKg: 260,
  },
  legcurl: {
    id: "legcurl",
    equipment: "Machine",
    repLow: 8,
    repHigh: 12,
    name: "Leg Curl",
    muscle: "Legs",
    lastKg: 45,
    lastReps: 12,
    workKg: 47.5,
    prKg: 60,
  },
  calf: {
    id: "calf",
    equipment: "Machine",
    repLow: 12,
    repHigh: 15,
    name: "Calf Raise",
    muscle: "Legs",
    lastKg: 80,
    lastReps: 15,
    workKg: 82.5,
    prKg: 110,
  },
  pullup: {
    id: "pullup",
    equipment: "Bodyweight",
    repLow: 6,
    repHigh: 10,
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
    equipment: "Machine",
    repLow: 8,
    repHigh: 12,
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
    equipment: "Bodyweight",
    repLow: 18,
    repHigh: 22,
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
    equipment: "Bodyweight",
    repLow: 8,
    repHigh: 12,
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
    equipment: "Bodyweight",
    repLow: 12,
    repHigh: 15,
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

/** Muscle filter chips shown by the exercise picker. */
export const MUSCLE_FILTERS: ("All" | Muscle)[] = [
  "All",
  "Chest",
  "Back",
  "Shoulders",
  "Arms",
  "Legs",
  "Core",
];

/** Starred by default — the lifts most people anchor a program around. */
export const FAVORITE_IDS = ["bench", "ohp", "deadlift", "squat", "latpd", "curl"];

export const ALL_EXERCISES: Exercise[] = Object.values(EXERCISES);
