import { loadJson } from "@/lib/storage";
import { loadVersioned, removeKey, saveVersioned } from "@/lib/versioned";
import { EXERCISES, type Exercise } from "./catalog";
import type { ActiveWorkout, PersonalRecord, Routine, Session } from "./types";

/**
 * Training data is stored in one key per slice so a change rewrites only what changed
 * (logging a set no longer rewrites the whole history).
 *   flux.training.<email>.sessions | prs | routines | active
 */
const key = (email: string, slice: string) => `flux.training.${email}.${slice}`;
const legacyKey = (email: string) => `flux.training.v1.${email}`;

export type Draft = { kg: number; reps: number };

type SerializedWorkout = {
  day: string;
  startedAt: number;
  index: number;
  links: Record<number, boolean>;
  exercises: { id: string; sets: ActiveWorkout["exercises"][number]["sets"]; plannedId?: string }[];
};

export type ActiveSnapshot = { workout: SerializedWorkout; draft: Draft };

export const serializeWorkout = (w: ActiveWorkout, draft: Draft): ActiveSnapshot => ({
  draft,
  workout: {
    day: w.day,
    startedAt: w.startedAt,
    index: w.index,
    links: w.links,
    exercises: w.exercises.map((e) => ({
      id: e.ex.id,
      sets: e.sets,
      ...(e.planned ? { plannedId: e.planned.id } : {}),
    })),
  },
});

/** Rebuilds a workout from a snapshot; null if it references an exercise that no longer exists. */
export function deserializeWorkout(
  snap: ActiveSnapshot | null,
): { workout: ActiveWorkout; draft: Draft } | null {
  if (!snap?.workout?.exercises?.length) return null;
  const exercises: ActiveWorkout["exercises"] = [];
  for (const e of snap.workout.exercises) {
    const ex: Exercise | undefined = EXERCISES[e.id];
    if (!ex) return null;
    exercises.push({
      ex,
      sets: e.sets ?? [],
      planned: e.plannedId ? EXERCISES[e.plannedId] : undefined,
    });
  }
  const { day, startedAt, links } = snap.workout;
  const index = Math.min(Math.max(0, snap.workout.index), exercises.length - 1);
  return { workout: { day, startedAt, index, links: links ?? {}, exercises }, draft: snap.draft };
}

export type TrainingSaved = {
  userSessions: Session[];
  prs: Record<string, PersonalRecord> | null;
  routines: Routine[];
  active: ActiveSnapshot | null;
};

type Legacy = {
  userSessions?: Session[];
  prs?: Record<string, PersonalRecord> | null;
  routines?: Routine[];
};

/** Loads every slice; falls back to the pre-split single-key format once. */
export async function loadTraining(email: string): Promise<TrainingSaved> {
  const legacy = await loadJson<Legacy>(legacyKey(email), {});
  const [userSessions, prs, routines, active] = await Promise.all([
    loadVersioned<Session[]>(key(email, "sessions"), {
      version: 1,
      fallback: legacy.userSessions ?? [],
    }),
    loadVersioned<Record<string, PersonalRecord> | null>(key(email, "prs"), {
      version: 1,
      fallback: legacy.prs ?? null,
    }),
    loadVersioned<Routine[]>(key(email, "routines"), {
      version: 1,
      fallback: legacy.routines ?? [],
    }),
    loadVersioned<ActiveSnapshot | null>(key(email, "active"), { version: 1, fallback: null }),
  ]);
  return { userSessions, prs, routines, active };
}

export const saveSessions = (email: string, v: Session[]) =>
  saveVersioned(key(email, "sessions"), 1, v);
export const savePrs = (email: string, v: Record<string, PersonalRecord> | null) =>
  saveVersioned(key(email, "prs"), 1, v);
export const saveRoutines = (email: string, v: Routine[]) =>
  saveVersioned(key(email, "routines"), 1, v);
export const saveActive = (email: string, v: ActiveSnapshot | null) =>
  v ? saveVersioned(key(email, "active"), 1, v) : removeKey(key(email, "active"));
