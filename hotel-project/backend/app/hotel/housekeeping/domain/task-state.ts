import { Conflict } from "@core/kernel/errors.js";
import type { HousekeepingStatus } from "@hotel/hotel/rooms/domain/room-status.js";

/**
 * Housekeeping task lifecycle, and the room status each step implies. The room's
 * `housekeeping_status` changes ONLY as a consequence of these transitions (and of check-out,
 * which makes the room dirty and opens a task) — never by editing the room.
 *
 *   PENDING ──assign──▶ ASSIGNED ──start──▶ IN_PROGRESS ──complete──▶ COMPLETED ──inspect──▶ INSPECTED
 *      └──────────start (self-assign)───────────┘
 */
export type TaskStatus = "pending" | "assigned" | "in_progress" | "completed" | "inspected";
export type TaskCommand = "assign" | "start" | "complete" | "inspect";

export const TASK_STATUSES: readonly TaskStatus[] = [
  "pending",
  "assigned",
  "in_progress",
  "completed",
  "inspected",
];

const TRANSITIONS: Record<TaskStatus, Partial<Record<TaskCommand, TaskStatus>>> = {
  pending: { assign: "assigned", start: "in_progress" },
  assigned: { assign: "assigned", start: "in_progress" },
  in_progress: { complete: "completed" },
  completed: { inspect: "inspected" },
  inspected: {},
};

/** What the room's housekeeping status becomes when a task reaches this status. */
export const ROOM_EFFECT: Partial<Record<TaskStatus, HousekeepingStatus>> = {
  in_progress: "cleaning",
  completed: "clean",
  inspected: "inspected",
};

export const OPEN_TASK_STATUSES: readonly TaskStatus[] = ["pending", "assigned", "in_progress"];

export function taskTransition(from: TaskStatus, command: TaskCommand): TaskStatus {
  const to = TRANSITIONS[from][command];
  if (!to) {
    throw Conflict(
      "housekeeping.invalid_transition",
      `A task that is ${from.replace("_", " ")} can't be ${PAST[command]}.`,
      { from, command },
    );
  }
  return to;
}

export function taskCommands(status: TaskStatus): TaskCommand[] {
  return Object.keys(TRANSITIONS[status]) as TaskCommand[];
}

const PAST: Record<TaskCommand, string> = {
  assign: "assigned",
  start: "started",
  complete: "completed",
  inspect: "inspected",
};
