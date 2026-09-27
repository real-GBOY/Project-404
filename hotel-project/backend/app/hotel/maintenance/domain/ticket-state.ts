import { Conflict } from "@core/kernel/errors.js";

/**
 * Maintenance ticket lifecycle.
 *
 *   OPEN ──assign──▶ ASSIGNED ──start──▶ IN_PROGRESS ──resolve──▶ RESOLVED ──verify──▶ VERIFIED
 *    └──────────start (self-assign)──────────┘                        │
 *                                     IN_PROGRESS ◀──────reopen───────┘
 *
 * RESOLVED means the technician says it's fixed; VERIFIED means a supervisor checked it. Only
 * verification returns a blocked room to service.
 */
export type TicketStatus = "open" | "assigned" | "in_progress" | "resolved" | "verified";
export type TicketCommand = "assign" | "start" | "resolve" | "reopen" | "verify";
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type RoomImpact = "none" | "maintenance" | "out_of_service";

export const TICKET_STATUSES: readonly TicketStatus[] = [
  "open",
  "assigned",
  "in_progress",
  "resolved",
  "verified",
];
export const OPEN_TICKET_STATUSES: readonly TicketStatus[] = [
  "open",
  "assigned",
  "in_progress",
  "resolved",
];

const TRANSITIONS: Record<TicketStatus, Partial<Record<TicketCommand, TicketStatus>>> = {
  open: { assign: "assigned", start: "in_progress" },
  assigned: { assign: "assigned", start: "in_progress" },
  in_progress: { resolve: "resolved" },
  resolved: { verify: "verified", reopen: "in_progress" },
  verified: {},
};

export function ticketTransition(from: TicketStatus, command: TicketCommand): TicketStatus {
  const to = TRANSITIONS[from][command];
  if (!to) {
    throw Conflict(
      "maintenance.invalid_transition",
      `A ${from.replace("_", " ")} ticket can't be ${PAST[command]}.`,
      { from, command },
    );
  }
  return to;
}

export function ticketCommands(status: TicketStatus): TicketCommand[] {
  return Object.keys(TRANSITIONS[status]) as TicketCommand[];
}

const PAST: Record<TicketCommand, string> = {
  assign: "assigned",
  start: "started",
  resolve: "resolved",
  reopen: "reopened",
  verify: "verified",
};
