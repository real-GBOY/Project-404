import { describe, expect, it } from "vitest";
import {
  ROOM_EFFECT,
  TASK_STATUSES,
  taskCommands,
  taskTransition,
  type TaskCommand,
} from "./task-state.js";

describe("housekeeping task state machine", () => {
  it("walks the full cleaning cycle and says what the room becomes", () => {
    let s = taskTransition("pending", "assign");
    expect(s).toBe("assigned");
    s = taskTransition(s, "start");
    expect([s, ROOM_EFFECT[s]]).toEqual(["in_progress", "cleaning"]);
    s = taskTransition(s, "complete");
    expect([s, ROOM_EFFECT[s]]).toEqual(["completed", "clean"]);
    s = taskTransition(s, "inspect");
    expect([s, ROOM_EFFECT[s]]).toEqual(["inspected", "inspected"]);
  });

  it("lets a housekeeper start an unassigned task (self-assign)", () => {
    expect(taskTransition("pending", "start")).toBe("in_progress");
  });

  it("rejects skipping steps", () => {
    const commands: TaskCommand[] = ["assign", "start", "complete", "inspect"];
    const legal = new Set(TASK_STATUSES.flatMap((s) => taskCommands(s).map((c) => `${s}:${c}`)));
    for (const s of TASK_STATUSES) {
      for (const c of commands) {
        if (legal.has(`${s}:${c}`)) continue;
        expect(() => taskTransition(s, c)).toThrow(
          expect.objectContaining({ code: "housekeeping.invalid_transition" }),
        );
      }
    }
    expect(() => taskTransition("pending", "complete")).toThrow();
    expect(() => taskTransition("assigned", "inspect")).toThrow();
  });
});
