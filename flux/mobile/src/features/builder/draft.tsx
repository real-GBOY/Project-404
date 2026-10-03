import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { RoutineItem } from "@/features/training/types";

export type BuilderDraft = {
  name: string;
  items: RoutineItem[];
  /** Index i → exercise i is linked to i+1 as a superset. */
  linked: Record<number, boolean>;
};

const EMPTY: BuilderDraft = { name: "My Workout", items: [], linked: {} };

type BuilderApi = {
  draft: BuilderDraft;
  /** Replaces the whole draft. */
  set: (next: BuilderDraft) => void;
  /** Merges fields into the draft. */
  patch: (p: Partial<BuilderDraft> | ((cur: BuilderDraft) => Partial<BuilderDraft>)) => void;
  reset: () => void;
};

const Ctx = createContext<BuilderApi | null>(null);

/**
 * The Builder and the Exercise Picker are separate routes, so the draft lives in a provider
 * above both (mounted by the (app) layout) rather than in either screen's state.
 */
export function BuilderDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<BuilderDraft>(EMPTY);
  // Actions keep their identity so effects can depend on them without re-running per edit.
  const actions = useMemo<Omit<BuilderApi, "draft">>(
    () => ({
      set: setDraft,
      patch: (p) => setDraft((cur) => ({ ...cur, ...(typeof p === "function" ? p(cur) : p) })),
      reset: () => setDraft(EMPTY),
    }),
    [],
  );
  const api = useMemo<BuilderApi>(() => ({ draft, ...actions }), [draft, actions]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useBuilder(): BuilderApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBuilder must be used inside <BuilderDraftProvider>");
  return v;
}

/** Removes item `idx` and shifts the superset links that pointed past it. */
export function removeItemAt(draft: BuilderDraft, idx: number): Partial<BuilderDraft> {
  const linked: Record<number, boolean> = {};
  for (const [k, v] of Object.entries(draft.linked)) {
    const n = Number(k);
    if (n < idx - 1) linked[n] = v;
    else if (n > idx) linked[n - 1] = v;
    // links touching the removed item (n === idx - 1 or n === idx) are dropped
  }
  return { items: draft.items.filter((_, i) => i !== idx), linked };
}

/** Defaults for a freshly-added exercise: 3 sets, 8–12 reps, last working weight as target. */
export const newItem = (id: string, targetKg: number, reps = "8-12"): RoutineItem => ({
  id,
  sets: 3,
  reps,
  targetKg,
});
