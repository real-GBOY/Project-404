import { beforeEach, describe, expect, it } from "vitest";
import { memoryStorage } from "@/test/setup";
import { EXERCISES } from "./catalog";
import {
  deserializeWorkout,
  loadTraining,
  saveActive,
  saveSessions,
  serializeWorkout,
} from "./persistence";
import type { Session } from "./types";
import { applyLogSet, createWorkout, swapCurrent } from "./workout";

const session = (id: string): Session => ({
  id,
  day: "PUSH DAY",
  date: "2026-03-01T10:00:00.000Z",
  volumeKg: 1000,
  minutes: 40,
  top: { name: "Bench Press", kg: 80, reps: 8, deltaKg: 2.5 },
});

beforeEach(() => memoryStorage.clear());

describe("active workout snapshot", () => {
  it("round-trips sets, links, swaps and the draft", () => {
    let w = createWorkout("PUSH", [EXERCISES.bench!, EXERCISES.row!], { 0: true });
    w = swapCurrent(w, EXERCISES.ohp!);
    w = applyLogSet(w, { kg: 50, reps: 8, type: "normal" }, {}).workout;
    const snap = JSON.parse(JSON.stringify(serializeWorkout(w, { kg: 52.5, reps: 8 })));
    const back = deserializeWorkout(snap)!;
    expect(back.draft).toEqual({ kg: 52.5, reps: 8 });
    expect(back.workout.links).toEqual({ 0: true });
    expect(back.workout.index).toBe(w.index);
    expect(back.workout.exercises[0]).toMatchObject({
      ex: EXERCISES.ohp,
      planned: EXERCISES.bench,
    });
    expect(back.workout.exercises[0]!.sets).toHaveLength(1);
  });

  it("drops a snapshot that references an unknown exercise", () => {
    const snap = serializeWorkout(createWorkout("X", [EXERCISES.bench!]), { kg: 1, reps: 1 });
    snap.workout.exercises[0]!.id = "removed-exercise";
    expect(deserializeWorkout(snap)).toBeNull();
    expect(deserializeWorkout(null)).toBeNull();
  });
});

describe("loadTraining", () => {
  it("starts empty", async () => {
    expect(await loadTraining("a@b.c")).toEqual({
      userSessions: [],
      prs: null,
      routines: [],
      active: null,
    });
  });

  it("imports the pre-split single-key format once", async () => {
    memoryStorage.set(
      "flux.training.v1.a@b.c",
      JSON.stringify({ userSessions: [session("old")], prs: { Squat: { kg: 150, date: "x" } } }),
    );
    const loaded = await loadTraining("a@b.c");
    expect(loaded.userSessions.map((s) => s.id)).toEqual(["old"]);
    expect(loaded.prs).toEqual({ Squat: { kg: 150, date: "x" } });
  });

  it("prefers the new per-slice keys and isolates accounts", async () => {
    memoryStorage.set("flux.training.v1.a@b.c", JSON.stringify({ userSessions: [session("old")] }));
    await saveSessions("a@b.c", [session("new")]);
    expect((await loadTraining("a@b.c")).userSessions.map((s) => s.id)).toEqual(["new"]);
    expect((await loadTraining("other@b.c")).userSessions).toEqual([]);
  });

  it("clears the active slice when saving null", async () => {
    const snap = serializeWorkout(createWorkout("X", [EXERCISES.bench!]), { kg: 1, reps: 1 });
    await saveActive("a@b.c", snap);
    expect((await loadTraining("a@b.c")).active).not.toBeNull();
    await saveActive("a@b.c", null);
    expect((await loadTraining("a@b.c")).active).toBeNull();
  });
});
