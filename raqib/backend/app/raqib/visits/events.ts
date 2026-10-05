import { defineEvent } from "@core/contracts/domain-event.js";

/** Visit domain events — published inside the transaction that caused them; notifications subscribe in-process. */
export const visitAssigned = (p: { visitId: string; inspectorId: string; actorId: string | null }) => defineEvent("raqib.visit_assigned", 1, p);
export const visitRescheduled = (p: { visitId: string; inspectorId: string; actorId: string | null }) => defineEvent("raqib.visit_rescheduled", 1, p);
export const visitUnassigned = (p: { visitId: string; previousInspectorId: string; actorId: string | null }) => defineEvent("raqib.visit_unassigned", 1, p);
export const visitCancelled = (p: { visitId: string; inspectorId: string | null; actorId: string | null; reason: string }) => defineEvent("raqib.visit_cancelled", 1, p);
export const visitOverdue = (p: { visitId: string }) => defineEvent("raqib.visit_overdue", 1, p);
