import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { daysBetween } from "@/lib/dates";
import { EXERCISES, type Exercise } from "./catalog";
import { targetFor, type Target } from "./engine";
import {
  deserializeWorkout,
  loadTraining,
  saveActive,
  savePrs,
  saveRoutines,
  saveSessions,
  serializeWorkout,
  type Draft,
} from "./persistence";
import { dayByName, nextPlan, type DayPlan } from "./plan";
import { seedPrs, seedSessions } from "./seed";
import type { ActiveWorkout, PersonalRecord, Routine, SetType, Session, Summary } from "./types";
import {
  REST_SECONDS,
  applyLogSet,
  createWorkout,
  finalizeWorkout,
  moveTo,
  nextExerciseIndex,
  swapCurrent,
} from "./workout";

export type LogResult = { newPR: boolean; previousKg: number; exercise: Exercise };
export type RestState = { endsAt: number; total: number };

/** Data that screens read. Changes when history / the running workout / routines change. */
export type TrainingState = {
  sessions: Session[];
  prs: Record<string, PersonalRecord>;
  todayPlan: DayPlan;
  routines: Routine[];
  workout: ActiveWorkout | null;
  /** Reward-moment data for the workout that was just finished. */
  summary: Summary | null;
};

/** Stable (never changes identity) — subscribing to it never causes a re-render. */
export type TrainingActions = {
  /** Starts today's plan unless a workout is already running. */
  startWorkout: () => void;
  /** Starts a workout from catalog exercise ids (replaces any running one). */
  startRoutine: (name: string, ids: string[], links?: Record<number, boolean>) => boolean;
  saveRoutine: (routine: Routine) => void;
  discardWorkout: () => void;
  /** Saves the running workout to history. Returns null if no working set was logged. */
  finishWorkout: () => Session | null;
  clearSummary: () => void;
  /** Attaches the post-workout note to the session in the summary. */
  saveNote: (note: string) => void;
  setDraft: (draft: Draft) => void;
  logSet: (kg: number, reps: number, type?: SetType) => LogResult | null;
  /** Moves past the current exercise (or superset group). False when already on the last one. */
  nextExercise: () => boolean;
  /** Replaces the current exercise; history records what was actually performed. */
  swapExercise: (ex: Exercise) => void;
  /** Progression-engine target (with reason) for an exercise, given when it was last trained. */
  targetOf: (ex: Exercise) => Target & { daysSince: number };
  startRest: (seconds?: number) => void;
  addRest: (seconds: number) => void;
  skipRest: () => void;
};

const StateCtx = createContext<TrainingState | null>(null);
const ActionsCtx = createContext<TrainingActions | null>(null);
/** Stepper values change on every tap; keeping them apart stops the tabs re-rendering. */
const DraftCtx = createContext<Draft | null>(null);
const RestCtx = createContext<RestState | null>(null);

type Props = { email: string; splitId: string; durationId: string; children: ReactNode };

/** Workout history, PRs and the in-progress workout for the signed-in account. */
export function TrainingProvider({ email, splitId, durationId, children }: Props) {
  const [userSessions, setUserSessions] = useState<Session[]>([]);
  const [savedPrs, setSavedPrs] = useState<Record<string, PersonalRecord> | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [workout, setWorkout] = useState<ActiveWorkout | null>(null);
  const [draft, setDraftState] = useState<Draft>({ kg: 0, reps: 0 });
  const [rest, setRest] = useState<RestState | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // ── hydrate (including a workout that was running when the app was closed) ──
  useEffect(() => {
    let live = true;
    setHydrated(false);
    void loadTraining(email).then((s) => {
      if (!live) return;
      setUserSessions(s.userSessions);
      setSavedPrs(s.prs);
      setRoutines(s.routines);
      const active = deserializeWorkout(s.active);
      if (active) {
        setWorkout(active.workout);
        setDraftState(active.draft);
      }
      setHydrated(true);
    });
    return () => {
      live = false;
    };
  }, [email]);

  // ── persist: one key per slice, written only when that slice changes ──
  useEffect(() => {
    if (hydrated) void saveSessions(email, userSessions);
  }, [hydrated, email, userSessions]);
  useEffect(() => {
    if (hydrated) void savePrs(email, savedPrs);
  }, [hydrated, email, savedPrs]);
  useEffect(() => {
    if (hydrated) void saveRoutines(email, routines);
  }, [hydrated, email, routines]);
  useEffect(() => {
    if (hydrated) void saveActive(email, workout ? serializeWorkout(workout, draft) : null);
  }, [hydrated, email, workout, draft]);

  // `new Date()` is captured once per mount so the seed does not reshuffle on every render.
  const [now] = useState(() => new Date());
  const seeded = useMemo(() => seedSessions(splitId, now), [splitId, now]);
  const sessions = useMemo(
    () =>
      [...userSessions, ...seeded].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [userSessions, seeded],
  );
  const prs = useMemo(() => savedPrs ?? seedPrs(now), [savedPrs, now]);
  const todayPlan = useMemo(
    () => nextPlan(splitId, durationId, sessions[0]?.day),
    [splitId, durationId, sessions],
  );

  // Actions read the latest values through this ref so their identity never changes.
  const live = useRef({ sessions, prs, todayPlan, workout, summary });
  live.current = { sessions, prs, todayPlan, workout, summary };

  const actions = useMemo<TrainingActions>(() => {
    const targetOf: TrainingActions["targetOf"] = (ex) => {
      const last = live.current.sessions.find((s) => dayByName(s.day)?.ids.includes(ex.id));
      const daysSince = last ? Math.max(0, daysBetween(new Date(), new Date(last.date))) : 0;
      return { ...targetFor(ex, daysSince), daysSince };
    };
    const draftFor = (ex: Exercise): Draft => {
      const t = targetOf(ex);
      return { kg: t.kg, reps: t.repLow };
    };
    const begin = (name: string, exercises: Exercise[], links: Record<number, boolean> = {}) => {
      setRest(null);
      setWorkout(createWorkout(name, exercises, links));
      setDraftState(draftFor(exercises[0]!));
    };

    return {
      targetOf,
      startWorkout: () => {
        if (live.current.workout) return;
        const plan = live.current.todayPlan;
        begin(plan.name, plan.exercises);
      },
      startRoutine: (name, ids, links = {}) => {
        const exercises = ids.map((id) => EXERCISES[id]).filter((e): e is Exercise => !!e);
        if (exercises.length === 0) return false;
        begin(name.toUpperCase(), exercises, links);
        return true;
      },
      saveRoutine: (routine) =>
        setRoutines((cur) => [routine, ...cur.filter((r) => r.id !== routine.id)]),
      discardWorkout: () => {
        setWorkout(null);
        setRest(null);
      },
      finishWorkout: () => {
        const w = live.current.workout;
        setWorkout(null);
        setRest(null);
        if (!w) return null;
        const res = finalizeWorkout(w, {
          sessions: live.current.sessions,
          prs: live.current.prs,
          now: new Date(),
        });
        if (!res) return null;
        setUserSessions((cur) => [res.session, ...cur]);
        setSummary(res.summary);
        return res.session;
      },
      clearSummary: () => setSummary(null),
      saveNote: (note) => {
        const id = live.current.summary?.sessionId;
        const text = note.trim();
        if (!id || !text) return;
        setUserSessions((cur) => cur.map((s) => (s.id === id ? { ...s, note: text } : s)));
      },
      setDraft: setDraftState,
      logSet: (kg, reps, type = "normal") => {
        const w = live.current.workout;
        if (!w) return null;
        const out = applyLogSet(w, { kg, reps, type }, live.current.prs);
        if (out.newPR) {
          setSavedPrs({
            ...live.current.prs,
            [out.exercise.name]: { kg, date: new Date().toISOString() },
          });
        }
        setWorkout(out.workout);
        if (out.workout.index !== w.index) {
          setDraftState(draftFor(out.workout.exercises[out.workout.index]!.ex));
        }
        if (out.startRest) {
          setRest({ endsAt: Date.now() + REST_SECONDS * 1000, total: REST_SECONDS });
        }
        return { newPR: out.newPR, previousKg: out.previousKg, exercise: out.exercise };
      },
      nextExercise: () => {
        const w = live.current.workout;
        if (!w) return false;
        const index = nextExerciseIndex(w);
        if (index === null) return false;
        setWorkout(moveTo(w, index));
        setDraftState(draftFor(w.exercises[index]!.ex));
        setRest(null);
        return true;
      },
      swapExercise: (ex) => {
        const w = live.current.workout;
        if (!w) return;
        setWorkout(swapCurrent(w, ex));
        setDraftState(draftFor(ex));
      },
      startRest: (seconds = REST_SECONDS) =>
        setRest({ endsAt: Date.now() + seconds * 1000, total: seconds }),
      addRest: (seconds) =>
        setRest((r) => (r ? { endsAt: r.endsAt + seconds * 1000, total: r.total + seconds } : r)),
      skipRest: () => setRest(null),
    };
  }, []);

  const state = useMemo<TrainingState>(
    () => ({ sessions, prs, todayPlan, routines, workout, summary }),
    [sessions, prs, todayPlan, routines, workout, summary],
  );

  return (
    <ActionsCtx.Provider value={actions}>
      <StateCtx.Provider value={state}>
        <DraftCtx.Provider value={draft}>
          <RestCtx.Provider value={rest}>{children}</RestCtx.Provider>
        </DraftCtx.Provider>
      </StateCtx.Provider>
    </ActionsCtx.Provider>
  );
}

function need<T>(v: T | null, name: string): T {
  if (v === null) throw new Error(`${name} must be used inside <TrainingProvider>`);
  return v;
}

export const useTrainingState = () => need(useContext(StateCtx), "useTrainingState");
export const useTrainingActions = () => need(useContext(ActionsCtx), "useTrainingActions");
/** Weight / reps currently in the steppers. Only the workout + voice screens should use this. */
export const useWorkoutDraft = () => need(useContext(DraftCtx), "useWorkoutDraft");
/** The raw rest timer (end time). Prefer {@link useRestRemaining} to show a countdown. */
export const useRest = () => useContext(RestCtx);

/** State + actions in one object, for screens that need both (not draft / rest). */
export function useTraining(): TrainingState & TrainingActions {
  const state = useTrainingState();
  const actions = useTrainingActions();
  return useMemo(() => ({ ...state, ...actions }), [state, actions]);
}

/** Seconds left on the rest timer (null when not resting). Clears the timer at zero. */
export function useRestRemaining(): { remaining: number; total: number } | null {
  const rest = useRest();
  const { skipRest } = useTrainingActions();
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    if (!rest) return;
    setTick(Date.now());
    const id = setInterval(() => setTick(Date.now()), 250);
    return () => clearInterval(id);
  }, [rest]);

  const remaining = rest ? Math.max(0, Math.ceil((rest.endsAt - tick) / 1000)) : 0;
  useEffect(() => {
    if (rest && remaining <= 0) skipRest();
  }, [rest, remaining, skipRest]);

  return rest ? { remaining, total: rest.total } : null;
}
