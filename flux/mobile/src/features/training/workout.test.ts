import { describe, expect, it } from "vitest";
import { EXERCISES } from "./catalog";
import type { PersonalRecord, Session } from "./types";
import {
  applyLogSet,
  createWorkout,
  finalizeWorkout,
  groupBounds,
  nextExerciseIndex,
  setDelta,
  swapCurrent,
} from "./workout";

const bench = EXERCISES.bench!;
const row = EXERCISES.row!;
const ohp = EXERCISES.ohp!;
const plank = EXERCISES.plankhold!;
const noPrs: Record<string, PersonalRecord> = {};

describe("setDelta", () => {
  const prev = { kg: 80, reps: 8 };
  it("ranks PR above everything", () => {
    expect(setDelta(100, 1, prev, true)).toEqual({ label: "New PR", kind: "pr" });
  });
  it("labels weight and rep gains, ties and drops", () => {
    expect(setDelta(82.5, 6, prev, false)).toEqual({ label: "+2.5 kg", kind: "up" });
    expect(setDelta(80, 10, prev, false)).toEqual({ label: "+2 reps", kind: "up" });
    expect(setDelta(80, 8, prev, false)).toEqual({ label: "Matched", kind: "flat" });
    expect(setDelta(77.5, 8, prev, false)).toEqual({ label: "Below last time", kind: "down" });
  });
  it("ignores load for reps-only and time lifts", () => {
    expect(setDelta(0, 22, { kg: 0, reps: 20 }, false, undefined, "reps").label).toBe("+2 reps");
    expect(setDelta(0, 65, { kg: 0, reps: 60 }, false, undefined, "time").label).toBe("+5 sec");
  });
});

describe("groupBounds / superset navigation", () => {
  const links = { 1: true, 2: true }; // 1-2-3 form a group
  it("finds the group around an index", () => {
    expect(groupBounds(links, 2)).toEqual({ start: 1, end: 3 });
    expect(groupBounds(links, 0)).toEqual({ start: 0, end: 0 });
  });
  it("jumps past a whole group", () => {
    const w = {
      ...createWorkout("X", [bench, row, ohp, EXERCISES.curl!, EXERCISES.fly!], links),
      index: 2,
    };
    expect(nextExerciseIndex(w)).toBe(4);
    expect(nextExerciseIndex({ ...w, index: 4 })).toBeNull();
  });
});

describe("applyLogSet", () => {
  it("logs a set, flags a PR and starts rest", () => {
    const w = createWorkout("PUSH", [bench]);
    const out = applyLogSet(w, { kg: bench.prKg + 2.5, reps: 3, type: "normal" }, noPrs);
    expect(out.newPR).toBe(true);
    expect(out.startRest).toBe(true);
    expect(out.workout.exercises[0]!.sets[0]!.delta?.kind).toBe("pr");
  });

  it("never gives a PR to warm-up, drop or failure sets", () => {
    const w = createWorkout("PUSH", [bench]);
    for (const type of ["warmup", "dropset", "failure"] as const) {
      expect(applyLogSet(w, { kg: 200, reps: 1, type }, noPrs).newPR).toBe(false);
    }
  });

  it("compares with the previous working set, skipping warm-ups", () => {
    let w = createWorkout("PUSH", [bench]);
    w = applyLogSet(w, { kg: 40, reps: 10, type: "warmup" }, noPrs).workout;
    const out = applyLogSet(w, { kg: bench.lastKg, reps: bench.lastReps, type: "normal" }, noPrs);
    expect(out.workout.exercises[0]!.sets[1]!.delta?.label).toBe("Matched");
  });

  it("rotates superset members without rest until the last one", () => {
    const w = createWorkout("SS", [bench, row], { 0: true });
    const a = applyLogSet(w, { kg: 60, reps: 8, type: "normal" }, noPrs);
    expect(a.workout.index).toBe(1);
    expect(a.startRest).toBe(false);
    const b = applyLogSet(a.workout, { kg: 60, reps: 8, type: "normal" }, noPrs);
    expect(b.workout.index).toBe(0);
    expect(b.startRest).toBe(true);
  });

  it("does not treat a time hold as a weight PR", () => {
    const w = createWorkout("CORE", [plank]);
    expect(applyLogSet(w, { kg: 0, reps: 999, type: "normal" }, noPrs).newPR).toBe(false);
  });
});

describe("swapCurrent", () => {
  it("keeps the planned exercise and survives a second swap", () => {
    const w = createWorkout("X", [bench]);
    const once = swapCurrent(w, ohp);
    expect(once.exercises[0]).toMatchObject({ ex: ohp, planned: bench });
    expect(swapCurrent(once, row).exercises[0]!.planned).toBe(bench);
  });
});

describe("finalizeWorkout", () => {
  const now = new Date("2026-03-04T12:00:00Z");
  const ctx = { sessions: [] as Session[], prs: noPrs, now };

  it("returns null when only warm-ups were logged", () => {
    let w = createWorkout("X", [bench], {}, now.getTime() - 60_000);
    w = applyLogSet(w, { kg: 40, reps: 10, type: "warmup" }, noPrs).workout;
    expect(finalizeWorkout(w, ctx)).toBeNull();
  });

  it("excludes warm-ups from volume and builds the summary", () => {
    let w = createWorkout("PUSH DAY", [bench], {}, now.getTime() - 45 * 60_000);
    w = applyLogSet(w, { kg: 40, reps: 10, type: "warmup" }, noPrs).workout;
    w = applyLogSet(w, { kg: bench.prKg + 5, reps: 2, type: "normal" }, noPrs).workout;
    const res = finalizeWorkout(w, ctx)!;
    expect(res.session.volumeKg).toBe((bench.prKg + 5) * 2);
    expect(res.session.minutes).toBe(45);
    expect(res.summary).toMatchObject({ exercises: 1, sets: 1, sessionId: res.session.id });
    expect(res.summary.prs[0]).toMatchObject({ name: "Bench Press", kg: bench.prKg + 5 });
    expect(res.summary.weekCount).toBe(1);
  });

  it("reports replaced exercises and keeps non-weight lifts out of volume", () => {
    let w = swapCurrent(createWorkout("X", [bench, plank]), ohp);
    w = applyLogSet(w, { kg: 50, reps: 8, type: "normal" }, noPrs).workout; // ohp (swapped)
    w = { ...w, index: 1 };
    w = applyLogSet(w, { kg: 0, reps: 70, type: "normal" }, noPrs).workout; // plank
    const res = finalizeWorkout(w, ctx)!;
    expect(res.summary.replaced).toEqual([{ from: "Bench Press", to: "Overhead Press" }]);
    expect(res.session.volumeKg).toBe(400);
    expect(res.session.top.name).toBe("Overhead Press");
  });
});
