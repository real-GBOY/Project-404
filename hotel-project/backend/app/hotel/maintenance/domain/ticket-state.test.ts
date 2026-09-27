import { describe, expect, it } from "vitest";
import {
  TICKET_STATUSES,
  ticketCommands,
  ticketTransition,
  type TicketCommand,
} from "./ticket-state.js";

describe("maintenance ticket state machine", () => {
  it("runs the full repair cycle", () => {
    let s = ticketTransition("open", "assign");
    s = ticketTransition(s, "start");
    s = ticketTransition(s, "resolve");
    expect(s).toBe("resolved");
    expect(ticketTransition(s, "verify")).toBe("verified");
  });

  it("sends a resolved ticket back to work when verification fails", () => {
    expect(ticketTransition("resolved", "reopen")).toBe("in_progress");
  });

  it("rejects every transition not in the table, and verified is terminal", () => {
    const commands: TicketCommand[] = ["assign", "start", "resolve", "reopen", "verify"];
    for (const s of TICKET_STATUSES) {
      const legal = new Set(ticketCommands(s));
      for (const c of commands) {
        if (legal.has(c)) continue;
        expect(() => ticketTransition(s, c)).toThrow(
          expect.objectContaining({ code: "maintenance.invalid_transition" }),
        );
      }
    }
    expect(ticketCommands("verified")).toEqual([]);
    expect(() => ticketTransition("open", "verify")).toThrow();
  });
});
