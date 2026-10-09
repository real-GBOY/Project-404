import { defineEvent } from "@core/contracts/domain-event.js";

/** Corrective-action events — published inside the transaction that caused them; notifications subscribe in-process. */
export const actionAssigned = (p: { actionId: string; actorId: string }) => defineEvent("raqib.action_assigned", 1, p);
export const actionSubmitted = (p: { actionId: string; actorId: string }) => defineEvent("raqib.action_submitted", 1, p);
export const actionReturned = (p: { actionId: string; actorId: string; reason: string }) => defineEvent("raqib.action_returned", 1, p);
export const actionClosed = (p: { actionId: string; actorId: string }) => defineEvent("raqib.action_closed", 1, p);
export const actionEscalated = (p: { actionId: string; level: number; days: number }) => defineEvent("raqib.action_escalated", 1, p);
export const actionOverdue = (p: { actionId: string }) => defineEvent("raqib.action_overdue", 1, p);
