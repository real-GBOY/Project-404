import { defineEvent } from "@core/contracts/domain-event.js";

/** Review workflow events — published inside the decision's transaction; notifications subscribe in-process. */
export const inspectionForwarded = (p: { visitId: string; actorId: string }) => defineEvent("raqib.inspection_forwarded", 1, p);
export const inspectionReturned = (p: { visitId: string; actorId: string; reason: string }) => defineEvent("raqib.inspection_returned", 1, p);
export const inspectionRejected = (p: { visitId: string; actorId: string; reason: string }) => defineEvent("raqib.inspection_rejected", 1, p);
export const inspectionApproved = (p: { visitId: string; actorId: string }) => defineEvent("raqib.inspection_approved", 1, p);
