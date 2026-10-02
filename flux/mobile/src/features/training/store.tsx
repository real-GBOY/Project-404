import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { loadJson, saveJson } from "@/lib/storage";
import { targetKg, type Exercise } from "./catalog";
import { nextPlan, type DayPlan } from "./plan";
import { seedPrs, seedSessions } from "./seed";
import type { ActiveWorkout, PersonalRecord, Session } from "./types";

type Persisted = { userSessions: Session[]; prs: Record<string, PersonalRecord> | null };

export type LogResult = { newPR: boolean; previousKg: number; exercise: Exercise };

type RestState = { endsAt: number; total: number };

type TrainingValue = {
  sessions: Session[];
  prs: Record<string, PersonalRecord>;
  todayPlan: DayPlan;
  workout: ActiveWorkout | null;
  /** Starts today's plan unless a workout is already running. */
  startWorkout: () => void;
  discardWorkout: () => void;
  /** Saves the running workout to history. Returns null if no set was logged. */
  finishWorkout: () => Session | null;
  setDraft: (draft: { kg: number; reps: number }) => void;
  logSet: (kg: number, reps: number) => LogResult | null;
  /** Moves to the next exercise. Returns false when already on the last one. */
  nextExercise: () => boolean;
  rest: RestState | null;
  startRest: (seconds?: number) => void;
  addRest: (seconds: number) => void;
  skipRest: () => void;
};

const TrainingContext = createContext<TrainingValue | null>(null);

const REST_SECONDS = 90;
const initialDraft = (ex: Exercise) => ({ kg: targetKg(ex), reps: ex.lastReps });

type Props = { email: string; splitId: string; durationId: string; children: ReactNode };

/** Workout history, PRs and the in-progress workout for the signed-in account. */
export function TrainingProvider({ email, splitId, durationId, children }: Props) {
  const storageKey = `flux.training.v1.${email}`;
  const [saved, setSaved] = useState<Persisted>({ userSessions: [], prs: null });
  const [workout, setWorkout] = useState<ActiveWorkout | null>(null);
  const [rest, setRest] = useState<RestState | null>(null);
  const workoutRef = useRef(workout);
  workoutRef.current = workout;
  const savedRef = useRef(saved);
  savedRef.current = saved;

  useEffect(() => {
    let live = true;
    void loadJson<Persisted>(storageKey, { userSessions: [], prs: null }).then((p) => {
      if (live) setSaved(p);
    });
    return () => {
      live = false;
    };
  }, [storageKey]);

  const persist = useCallback(
    (next: Persisted) => {
      setSaved(next);
      void saveJson(storageKey, next);
    },
    [storageKey],
  );

  // `new Date()` is captured once per mount so the seed doesn't reshuffle on every render.
  const [now] = useState(() => new Date());
  const seeded = useMemo(() => seedSessions(splitId, now), [splitId, now]);
  const sessions = useMemo(
    () =>
      [...saved.userSessions, ...seeded].sort((a, b) =>
        a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
      ),
    [saved.userSessions, seeded],
  );
  const prs = useMemo(() => saved.prs ?? seedPrs(now), [saved.prs, now]);
  const todayPlan = useMemo(
    () => nextPlan(splitId, durationId, sessions[0]?.day),
    [splitId, durationId, sessions],
  );

  const startWorkout = useCallback(() => {
    if (workoutRef.current) return;
    const first = todayPlan.exercises[0]!;
    setWorkout({
      day: todayPlan.name,
      startedAt: Date.now(),
      exercises: todayPlan.exercises.map((ex) => ({ ex, sets: [] })),
      index: 0,
      draft: initialDraft(first),
    });
  }, [todayPlan]);

  const discardWorkout = useCallback(() => {
    setWorkout(null);
    setRest(null);
  }, []);

  const setDraft = useCallback((draft: { kg: number; reps: number }) => {
    setWorkout((w) => (w ? { ...w, draft } : w));
  }, []);

  const logSet = useCallback<TrainingValue["logSet"]>(
    (kg, reps) => {
      const w = workoutRef.current;
      if (!w) return null;
      const entry = w.exercises[w.index]!;
      const previousKg = prs[entry.ex.name]?.kg ?? entry.ex.prKg;
      const newPR = kg > previousKg;
      const sets = [...entry.sets, { n: entry.sets.length + 1, kg, reps, rpe: 8 }];
      setWorkout({
        ...w,
        exercises: w.exercises.map((e, i) => (i === w.index ? { ...e, sets } : e)),
      });
      if (newPR) {
        const nextPrs = { ...prs, [entry.ex.name]: { kg, date: new Date().toISOString() } };
        persist({ ...savedRef.current, prs: nextPrs });
      }
      setRest({ endsAt: Date.now() + REST_SECONDS * 1000, total: REST_SECONDS });
      return { newPR, previousKg, exercise: entry.ex };
    },
    [persist, prs],
  );

  const nextExercise = useCallback(() => {
    const w = workoutRef.current;
    if (!w || w.index >= w.exercises.length - 1) return false;
    const index = w.index + 1;
    setWorkout({ ...w, index, draft: initialDraft(w.exercises[index]!.ex) });
    setRest(null);
    return true;
  }, []);

  const finishWorkout = useCallback<TrainingValue["finishWorkout"]>(() => {
    const w = workoutRef.current;
    setWorkout(null);
    setRest(null);
    if (!w) return null;
    const logged = w.exercises.filter((e) => e.sets.length > 0);
    if (logged.length === 0) return null;
    const volumeKg = logged.reduce(
      (sum, e) => sum + e.sets.reduce((s, x) => s + x.kg * x.reps, 0),
      0,
    );
    const best = logged
      .map((e) => ({ ex: e.ex, set: e.sets.reduce((a, b) => (b.kg >= a.kg ? b : a)) }))
      .sort((a, b) => b.set.kg - a.set.kg)[0]!;
    const session: Session = {
      id: `s-${Date.now()}`,
      day: w.day,
      date: new Date().toISOString(),
      volumeKg: Math.round(volumeKg),
      minutes: Math.max(1, Math.round((Date.now() - w.startedAt) / 60000)),
      top: {
        name: best.ex.name,
        kg: best.set.kg,
        reps: best.set.reps,
        deltaKg: best.set.kg - best.ex.lastKg,
      },
    };
    persist({ ...savedRef.current, userSessions: [session, ...savedRef.current.userSessions] });
    return session;
  }, [persist]);

  const startRest = useCallback((seconds = REST_SECONDS) => {
    setRest({ endsAt: Date.now() + seconds * 1000, total: seconds });
  }, []);
  const addRest = useCallback((seconds: number) => {
    setRest((r) => (r ? { endsAt: r.endsAt + seconds * 1000, total: r.total + seconds } : r));
  }, []);
  const skipRest = useCallback(() => setRest(null), []);

  const value = useMemo<TrainingValue>(
    () => ({
      sessions,
      prs,
      todayPlan,
      workout,
      startWorkout,
      discardWorkout,
      finishWorkout,
      setDraft,
      logSet,
      nextExercise,
      rest,
      startRest,
      addRest,
      skipRest,
    }),
    [
      sessions,
      prs,
      todayPlan,
      workout,
      startWorkout,
      discardWorkout,
      finishWorkout,
      setDraft,
      logSet,
      nextExercise,
      rest,
      startRest,
      addRest,
      skipRest,
    ],
  );

  return <TrainingContext.Provider value={value}>{children}</TrainingContext.Provider>;
}

export function useTraining(): TrainingValue {
  const ctx = useContext(TrainingContext);
  if (!ctx) throw new Error("useTraining must be used inside <TrainingProvider>");
  return ctx;
}

/** Seconds left on the rest timer (null when not resting). Clears the timer at zero. */
export function useRestRemaining(): { remaining: number; total: number } | null {
  const { rest, skipRest } = useTraining();
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
