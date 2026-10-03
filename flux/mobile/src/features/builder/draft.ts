import { useSyncExternalStore } from "react";
import type { RoutineItem } from "@/features/training/types";

export type BuilderDraft = {
  name: string;
  items: RoutineItem[];
  /** Index i → exercise i is linked to i+1 as a superset. */
  linked: Record<number, boolean>;
};

const EMPTY: BuilderDraft = { name: "My Workout", items: [], linked: {} };

let draft: BuilderDraft = EMPTY;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

/** The Builder and the Exercise Picker are separate routes, so the draft lives outside both. */
export const builderDraft = {
  get: () => draft,
  set(next: BuilderDraft) {
    draft = next;
    emit();
  },
  patch(p: Partial<BuilderDraft>) {
    draft = { ...draft, ...p };
    emit();
  },
  reset(next: Partial<BuilderDraft> = {}) {
    draft = { ...EMPTY, ...next };
    emit();
  },
};

export function useBuilderDraft(): BuilderDraft {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => draft,
  );
}

/** Defaults for a freshly-added exercise: 3 sets, 8–12 reps, last working weight as target. */
export const newItem = (id: string, targetKg: number, reps = "8-12"): RoutineItem => ({
  id,
  sets: 3,
  reps,
  targetKg,
});
