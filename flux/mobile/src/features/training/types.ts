import type { Exercise } from "./catalog";

export type TopLift = { name: string; kg: number; reps: number; deltaKg: number };

export type Session = {
  id: string;
  /** "PUSH DAY" */
  day: string;
  /** ISO timestamp */
  date: string;
  volumeKg: number;
  minutes: number;
  top: TopLift;
  /** Optional post-workout note. */
  note?: string;
};

export type PersonalRecord = { kg: number; date: string };

export type SetDelta = { label: string; kind: "pr" | "up" | "flat" | "down" };

export type SetType = "normal" | "warmup" | "dropset" | "failure";

export type LoggedSet = {
  n: number;
  kg: number;
  reps: number;
  rpe: number;
  type?: SetType;
  delta?: SetDelta;
};

/** A user-built workout template (Workout Builder). */
export type RoutineItem = { id: string; sets: number; reps: string; targetKg: number };
/** `linked[i]` → item i is superset-paired with item i + 1. */
export type Routine = {
  id: string;
  name: string;
  items: RoutineItem[];
  linked?: Record<number, boolean>;
};

/** Reward-moment data shown right after a workout is finished. */
export type Summary = {
  day: string;
  minutes: number;
  exercises: number;
  sets: number;
  volumeKg: number;
  progress: { name: string; delta: SetDelta }[];
  prs: { name: string; kg: number; reps: number; previousKg: number }[];
  weekCount: number;
  streak: number;
  replaced: { from: string; to: string }[];
  sessionId: string;
};

export type ActiveWorkout = {
  day: string;
  startedAt: number;
  /** `planned` is set when the exercise was swapped mid-workout (history keeps what was done). */
  exercises: { ex: Exercise; sets: LoggedSet[]; planned?: Exercise }[];
  index: number;
  /** `links[i]` → exercise i is superset-paired with i + 1 (no rest between). */
  links: Record<number, boolean>;
};
