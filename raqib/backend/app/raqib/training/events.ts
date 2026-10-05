import { defineEvent } from "@core/contracts/domain-event.js";

/** Training request events — published inside the transaction that caused them; notifications subscribe in-process. */
export const trainingRequested = (p: { requestId: string; actorId: string }) => defineEvent("raqib.training_requested", 1, p);
export const trainingApproved = (p: { requestId: string; actorId: string }) => defineEvent("raqib.training_approved", 1, p);
export const trainingDecided = (p: { requestId: string; actorId: string; decision: string; reason: string }) => defineEvent("raqib.training_decided", 1, p);
export const trainingScheduled = (p: { requestId: string; actorId: string }) => defineEvent("raqib.training_scheduled", 1, p);
export const trainingCompleted = (p: { requestId: string; actorId: string }) => defineEvent("raqib.training_completed", 1, p);
