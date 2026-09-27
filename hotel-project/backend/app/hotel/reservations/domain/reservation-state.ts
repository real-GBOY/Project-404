import { Conflict } from "@core/kernel/errors.js";

/**
 * The reservation lifecycle (docs/architecture.md §4). This pure function is the ONLY place that
 * decides whether a status change is legal; every use case asks it before touching the row.
 *
 *   PENDING ──confirm──▶ CONFIRMED ──check_in──▶ CHECKED_IN ──check_out──▶ CHECKED_OUT
 *      │                    │  └──no_show──▶ NO_SHOW
 *      └──cancel──▶ CANCELLED ◀──cancel──┘
 */
export type ReservationStatus =
  "pending" | "confirmed" | "checked_in" | "checked_out" | "cancelled" | "no_show";

export type ReservationCommand = "confirm" | "check_in" | "check_out" | "cancel" | "no_show";

export const RESERVATION_STATUSES: readonly ReservationStatus[] = [
  "pending",
  "confirmed",
  "checked_in",
  "checked_out",
  "cancelled",
  "no_show",
];

const TRANSITIONS: Record<
  ReservationStatus,
  Partial<Record<ReservationCommand, ReservationStatus>>
> = {
  pending: { confirm: "confirmed", cancel: "cancelled" },
  confirmed: { check_in: "checked_in", cancel: "cancelled", no_show: "no_show" },
  checked_in: { check_out: "checked_out" },
  checked_out: {},
  cancelled: {},
  no_show: {},
};

/** Statuses whose stay still holds room inventory. */
export const HOLDS_INVENTORY: ReadonlySet<ReservationStatus> = new Set([
  "pending",
  "confirmed",
  "checked_in",
]);

/** Statuses whose dates or room may still be changed. */
export const MODIFIABLE: ReadonlySet<ReservationStatus> = new Set(["pending", "confirmed"]);

export function canTransition(from: ReservationStatus, command: ReservationCommand): boolean {
  return TRANSITIONS[from][command] !== undefined;
}

/** The next status, or a 409 `reservation.invalid_transition` naming what was attempted. */
export function transition(
  from: ReservationStatus,
  command: ReservationCommand,
): ReservationStatus {
  const to = TRANSITIONS[from][command];
  if (!to) {
    throw Conflict(
      "reservation.invalid_transition",
      `A ${from.replace("_", " ")} reservation can't be ${PAST[command]}.`,
      { from, command },
    );
  }
  return to;
}

/** Commands a reservation in `status` accepts — drives which actions the UI offers. */
export function availableCommands(status: ReservationStatus): ReservationCommand[] {
  return Object.keys(TRANSITIONS[status]) as ReservationCommand[];
}

const PAST: Record<ReservationCommand, string> = {
  confirm: "confirmed",
  check_in: "checked in",
  check_out: "checked out",
  cancel: "cancelled",
  no_show: "marked as a no-show",
};
