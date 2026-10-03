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
import { EXERCISES, trackingOf, type Exercise } from "./catalog";
import { shapeOf } from "./format";
import { targetFor, type Target } from "./engine";
import { daysBetween } from "@/lib/dates";
import { dayByName, nextPlan, type DayPlan } from "./plan";
import { seedPrs, seedSessions } from "./seed";
import { startOfWeek } from "@/lib/dates";
import { streak as streakOf } from "./metrics";
import type {
  ActiveWorkout,
  PersonalRecord,
  Routine,
  SetDelta,
  SetType,
  Session,
  Summary,
} from "./types";

type Persisted = {
  userSessions: Session[];
  prs: Record<string, PersonalRecord> | null;
  routines?: Routine[];
};

export type LogResult = { newPR: boolean; previousKg: number; exercise: Exercise };

type RestState = { endsAt: number; total: number };

type TrainingValue = {
  sessions: Session[];
  prs: Record<string, PersonalRecord>;
  todayPlan: DayPlan;
  workout: ActiveWorkout | null;
  /** Starts today's plan unless a workout is already running. */
  startWorkout: () => void;
  /** Starts a workout from an ordered list of catalog exercise ids (replaces any running one). */
  /** Replaces the current exercise (history records what was actually performed). */
  swapExercise: (ex: Exercise) => void;
  /** Attaches the post-workout note to the session in the summary. */
  saveNote: (note: string) => void;
  startRoutine: (name: string, ids: string[], links?: Record<number, boolean>) => boolean;
  /** Progression-engine target (with reason) for an exercise, given when it was last trained. */
  targetOf: (ex: Exercise) => Target & { daysSince: number };
  routines: Routine[];
  saveRoutine: (routine: Routine) => void;
  /** Reward-moment data for the workout that was just finished. */
  summary: Summary | null;
  clearSummary: () => void;
  discardWorkout: () => void;
  /** Saves the running workout to history. Returns null if no set was logged. */
  finishWorkout: () => Session | null;
  setDraft: (draft: { kg: number; reps: number }) => void;
  logSet: (kg: number, reps: number, type?: SetType) => LogResult | null;
  /** Moves to the next exercise. Returns false when already on the last one. */
  nextExercise: () => boolean;
  rest: RestState | null;
  startRest: (seconds?: number) => void;
  addRest: (seconds: number) => void;
  skipRest: () => void;
};

const TrainingContext = createContext<TrainingValue | null>(null);

const REST_SECONDS = 90;

type DeltaMode = "weight" | "reps" | "time";

const deltaMode = (ex: Exercise): DeltaMode => {
  const t = trackingOf(ex);
  return t === "time" ? "time" : t === "weight_reps" || t === "bodyweight_reps" ? "weight" : "reps";
};

/** One badge per set, ranked PR > gain > matched > below. Reps/time lifts ignore the load. */
function setDelta(
  kg: number,
  reps: number,
  prev: { kg: number; reps: number },
  pr: boolean,
  fmt: (kg: number) => string,
  mode: DeltaMode = "weight",
): SetDelta {
  if (pr) return { label: "New PR", kind: "pr" };
  if (mode === "weight" && kg > prev.kg) {
    return { label: `+${fmt(kg - prev.kg)} kg`, kind: "up" };
  }
  const sameLoad = mode !== "weight" || kg === prev.kg;
  if (sameLoad && reps > prev.reps) {
    const n = reps - prev.reps;
    const unit = mode === "time" ? "sec" : `rep${n > 1 ? "s" : ""}`;
    return { label: `+${n} ${unit}`, kind: "up" };
  }
  if (sameLoad && reps === prev.reps) return { label: "Matched", kind: "flat" };
  return { label: "Below last time", kind: "down" };
}
const trimKg = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

type Props = { email: string; splitId: string; durationId: string; children: ReactNode };

/** Workout history, PRs and the in-progress workout for the signed-in account. */
export function TrainingProvider({ email, splitId, durationId, children }: Props) {
  const storageKey = `flux.training.v1.${email}`;
  const [saved, setSaved] = useState<Persisted>({ userSessions: [], prs: null });
  const [workout, setWorkout] = useState<ActiveWorkout | null>(null);
  const [rest, setRest] = useState<RestState | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
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

  const targetOf = useCallback<TrainingValue["targetOf"]>(
    (ex) => {
      const last = sessions.find((s) => dayByName(s.day)?.ids.includes(ex.id));
      const daysSince = last ? Math.max(0, daysBetween(new Date(), new Date(last.date))) : 0;
      return { ...targetFor(ex, daysSince), daysSince };
    },
    [sessions],
  );
  const draftFor = useCallback(
    (ex: Exercise) => {
      const t = targetOf(ex);
      return { kg: t.kg, reps: t.repLow };
    },
    [targetOf],
  );

  const startWorkout = useCallback(() => {
    if (workoutRef.current) return;
    const first = todayPlan.exercises[0]!;
    setWorkout({
      day: todayPlan.name,
      startedAt: Date.now(),
      exercises: todayPlan.exercises.map((ex) => ({ ex, sets: [] })),
      index: 0,
      links: {},
      draft: draftFor(first),
    });
  }, [todayPlan, draftFor]);

  const startRoutine = useCallback<TrainingValue["startRoutine"]>(
    (name, ids, links = {}) => {
      const exercises = ids.map((id) => EXERCISES[id]).filter((e): e is Exercise => !!e);
      if (exercises.length === 0) return false;
      setRest(null);
      setWorkout({
        day: name.toUpperCase(),
        startedAt: Date.now(),
        exercises: exercises.map((ex) => ({ ex, sets: [] })),
        index: 0,
        links,
        draft: draftFor(exercises[0]!),
      });
      return true;
    },
    [draftFor],
  );

  const saveRoutine = useCallback(
    (routine: Routine) => {
      const cur = savedRef.current;
      const others = (cur.routines ?? []).filter((r) => r.id !== routine.id);
      persist({ ...cur, routines: [routine, ...others] });
    },
    [persist],
  );

  const discardWorkout = useCallback(() => {
    setWorkout(null);
    setRest(null);
  }, []);

  const setDraft = useCallback((draft: { kg: number; reps: number }) => {
    setWorkout((w) => (w ? { ...w, draft } : w));
  }, []);

  const logSet = useCallback<TrainingValue["logSet"]>(
    (kg, reps, type = "normal") => {
      const w = workoutRef.current;
      if (!w) return null;
      const entry = w.exercises[w.index]!;
      const previousKg = prs[entry.ex.name]?.kg ?? entry.ex.prKg;
      // Warm-up, drop and failure sets never set a weight PR (not a clean working effort).
      const newPR = type === "normal" && shapeOf(entry.ex).weighted && kg > previousKg;
      const working = entry.sets.filter((s) => s.type !== "warmup");
      const prev = working[working.length - 1] ?? {
        kg: entry.ex.lastKg,
        reps: entry.ex.lastReps,
      };
      const delta: SetDelta =
        type === "warmup"
          ? { label: "Warm-up", kind: "flat" }
          : setDelta(kg, reps, prev, newPR, trimKg, deltaMode(entry.ex));
      const sets = [...entry.sets, { n: entry.sets.length + 1, kg, reps, rpe: 8, type, delta }];
      const exercises = w.exercises.map((e, i) => (i === w.index ? { ...e, sets } : e));
      if (newPR) {
        const nextPrs = { ...prs, [entry.ex.name]: { kg, date: new Date().toISOString() } };
        persist({ ...savedRef.current, prs: nextPrs });
      }

      // Supersets rotate through the group with no rest; rest starts after the last member.
      let end = w.index;
      while (w.links[end]) end++;
      let start = w.index;
      while (w.links[start - 1]) start--;
      const startRest = () =>
        setRest({ endsAt: Date.now() + REST_SECONDS * 1000, total: REST_SECONDS });
      if (end > start) {
        const nextIdx = w.index < end ? w.index + 1 : start;
        setWorkout({ ...w, exercises, index: nextIdx, draft: draftFor(w.exercises[nextIdx]!.ex) });
        if (w.index === end) startRest();
      } else {
        setWorkout({ ...w, exercises });
        startRest();
      }
      return { newPR, previousKg, exercise: entry.ex };
    },
    [persist, prs, draftFor],
  );

  const nextExercise = useCallback(() => {
    const w = workoutRef.current;
    if (!w) return false;
    // A superset group is left as a whole: jump past its last member.
    let end = w.index;
    while (w.links[end]) end++;
    const index = end + 1;
    if (index >= w.exercises.length) return false;
    setWorkout({ ...w, index, draft: draftFor(w.exercises[index]!.ex) });
    setRest(null);
    return true;
  }, [draftFor]);

  const finishWorkout = useCallback<TrainingValue["finishWorkout"]>(() => {
    const w = workoutRef.current;
    setWorkout(null);
    setRest(null);
    if (!w) return null;
    // Warm-ups do not count towards volume, PRs or progress.
    const logged = w.exercises
      .map((e) => ({ ...e, sets: e.sets.filter((s) => s.type !== "warmup") }))
      .filter((e) => e.sets.length > 0);
    if (logged.length === 0) return null;
    const volumeKg = logged.reduce(
      (sum, e) =>
        shapeOf(e.ex).weighted ? sum + e.sets.reduce((s, x) => s + x.kg * x.reps, 0) : sum,
      0,
    );
    const tops = logged
      .map((e) => ({ ex: e.ex, set: e.sets.reduce((a, b) => (b.kg >= a.kg ? b : a)) }))
      .sort((a, b) => b.set.kg - a.set.kg);
    const best = tops.find((t) => shapeOf(t.ex).weighted) ?? tops[0]!;
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

    const now = new Date();
    const weekStart = startOfWeek(now).getTime();
    const all = [session, ...sessions];
    const bestSet = (sets: { kg: number; reps: number }[]) =>
      sets.reduce((a, b) => (b.kg > a.kg || (b.kg === a.kg && b.reps > a.reps) ? b : a));
    setSummary({
      day: w.day,
      minutes: session.minutes,
      exercises: logged.length,
      sets: logged.reduce((n, e) => n + e.sets.length, 0),
      volumeKg: session.volumeKg,
      progress: logged.map((e) => {
        const b = bestSet(e.sets);
        return {
          name: e.ex.name,
          delta: setDelta(
            b.kg,
            b.reps,
            { kg: e.ex.lastKg, reps: e.ex.lastReps },
            false,
            trimKg,
            deltaMode(e.ex),
          ),
        };
      }),
      prs: logged.flatMap((e) => {
        const hit = e.sets.filter((s) => s.delta?.kind === "pr");
        if (hit.length === 0) return [];
        const b = bestSet(hit);
        return [
          { name: e.ex.name, kg: b.kg, reps: b.reps, previousKg: prs[e.ex.name]?.kg ?? e.ex.prKg },
        ];
      }),
      weekCount: all.filter((x) => new Date(x.date).getTime() >= weekStart).length,
      streak: streakOf(all, now),
      replaced: logged
        .filter((e) => e.planned && e.planned.id !== e.ex.id)
        .map((e) => ({ from: e.planned!.name, to: e.ex.name })),
      sessionId: session.id,
    });
    return session;
  }, [persist, sessions, prs]);

  const clearSummary = useCallback(() => setSummary(null), []);

  const swapExercise = useCallback<TrainingValue["swapExercise"]>(
    (ex) => {
      const w = workoutRef.current;
      if (!w) return;
      const entry = w.exercises[w.index]!;
      setWorkout({
        ...w,
        exercises: w.exercises.map((e, i) =>
          i === w.index ? { ...e, ex, planned: e.planned ?? entry.ex } : e,
        ),
        draft: draftFor(ex),
      });
    },
    [draftFor],
  );

  const saveNote = useCallback<TrainingValue["saveNote"]>(
    (note) => {
      const id = summary?.sessionId;
      const text = note.trim();
      if (!id || !text) return;
      const cur = savedRef.current;
      persist({
        ...cur,
        userSessions: cur.userSessions.map((s) => (s.id === id ? { ...s, note: text } : s)),
      });
    },
    [persist, summary],
  );

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
      startRoutine,
      swapExercise,
      saveNote,
      targetOf,
      routines: saved.routines ?? [],
      saveRoutine,
      summary,
      clearSummary,
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
      startRoutine,
      swapExercise,
      saveNote,
      targetOf,
      saved.routines,
      saveRoutine,
      summary,
      clearSummary,
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
