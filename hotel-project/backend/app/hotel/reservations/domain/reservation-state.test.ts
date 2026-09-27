import { describe, expect, it } from "vitest";
import {
  availableCommands,
  canTransition,
  RESERVATION_STATUSES,
  transition,
  type ReservationCommand,
  type ReservationStatus,
} from "./reservation-state.js";

const COMMANDS: ReservationCommand[] = ["confirm", "check_in", "check_out", "cancel", "no_show"];

/** The complete legal transition table — every other (status, command) pair must be rejected. */
const LEGAL: Array<[ReservationStatus, ReservationCommand, ReservationStatus]> = [
  ["pending", "confirm", "confirmed"],
  ["pending", "cancel", "cancelled"],
  ["confirmed", "check_in", "checked_in"],
  ["confirmed", "cancel", "cancelled"],
  ["confirmed", "no_show", "no_show"],
  ["checked_in", "check_out", "checked_out"],
];

describe("reservation state machine", () => {
  it.each(LEGAL)("%s --%s--> %s", (from, command, to) => {
    expect(canTransition(from, command)).toBe(true);
    expect(transition(from, command)).toBe(to);
  });

  it("rejects every transition not in the table (exhaustive)", () => {
    const legal = new Set(LEGAL.map(([f, c]) => `${f}:${c}`));
    let rejected = 0;
    for (const from of RESERVATION_STATUSES) {
      for (const command of COMMANDS) {
        if (legal.has(`${from}:${command}`)) continue;
        expect(canTransition(from, command)).toBe(false);
        expect(() => transition(from, command)).toThrow(
          expect.objectContaining({ code: "reservation.invalid_transition" }),
        );
        rejected++;
      }
    }
    expect(rejected).toBe(RESERVATION_STATUSES.length * COMMANDS.length - LEGAL.length);
  });

  it("treats checked-out, cancelled and no-show as terminal", () => {
    for (const s of ["checked_out", "cancelled", "no_show"] as const) {
      expect(availableCommands(s)).toEqual([]);
    }
  });

  it("never lets a pending booking skip confirmation to check in", () => {
    expect(canTransition("pending", "check_in")).toBe(false);
    expect(canTransition("pending", "no_show")).toBe(false);
  });
});
