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
};

export type PersonalRecord = { kg: number; date: string };

export type LoggedSet = { n: number; kg: number; reps: number; rpe: number };

export type ActiveWorkout = {
  day: string;
  startedAt: number;
  exercises: { ex: Exercise; sets: LoggedSet[] }[];
  index: number;
  /** current stepper values for the exercise being logged */
  draft: { kg: number; reps: number };
};
