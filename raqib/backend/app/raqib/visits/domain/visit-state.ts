import { zonedInstant } from "@raqib/raqib/shared/dates.js";

/**
 * The visit lifecycle as pure functions (no I/O). Phase 2 owns scheduling; the inspection phases add the
 * transitions that run through in_progress → pending_review → pending_approval → approved (and returned /
 * rejected). The table of legal moves lives here so a transition is validated in exactly one place.
 */
export const VISIT_STATUSES = [
  "scheduled",
  "assigned",
  "in_progress",
  "pending_review",
  "pending_approval",
  "returned",
  "approved",
  "rejected",
  "cancelled",
] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];
/** `overdue` is derived, never stored. */
export type DisplayStatus = VisitStatus | "overdue";

export type VisitAction = "schedule" | "assign" | "reschedule" | "cancel" | "start";

/** The review workflow's decisions (Phase 4). Review and approval are separate stages with separate permissions. */
export type ReviewAction = "forward" | "return" | "reject" | "approve";

/**
 * The status a review decision leads to, or null when it is not allowed from `from`:
 *   pending_review   --forward--> pending_approval
 *   pending_approval --approve--> approved
 *   pending_review | pending_approval --return--> returned   (back to the inspector, reason required)
 *   pending_review | pending_approval --reject--> rejected   (final, reason required)
 */
export function reviewNext(from: VisitStatus, action: ReviewAction): VisitStatus | null {
  switch (action) {
    case "forward":
      return from === "pending_review" ? "pending_approval" : null;
    case "approve":
      return from === "pending_approval" ? "approved" : null;
    case "return":
      return from === "pending_review" || from === "pending_approval" ? "returned" : null;
    case "reject":
      return from === "pending_review" || from === "pending_approval" ? "rejected" : null;
  }
}

/** The permission letter a decision needs at a given stage: reviewing at the review stage, approving at the approval stage. */
export function letterFor(from: VisitStatus, action: ReviewAction): "R" | "P" {
  if (action === "approve") return "P";
  if (action === "forward") return "R";
  return from === "pending_approval" ? "P" : "R";
}

/** Statuses from which the visit can still be moved or called off (not under review, not decided). */
const CHANGEABLE: readonly VisitStatus[] = ["scheduled", "assigned", "in_progress", "returned"];

export function isChangeable(status: VisitStatus): boolean {
  return CHANGEABLE.includes(status);
}

/** The status a transition leads to, or null when the move is not allowed from `from`. */
export function next(from: VisitStatus | null, action: VisitAction, hasInspector: boolean): VisitStatus | null {
  switch (action) {
    case "schedule":
      return from === null ? (hasInspector ? "assigned" : "scheduled") : null;
    case "assign":
    case "reschedule":
      if (from === null || !isChangeable(from)) return null;
      // naming an inspector on an unassigned visit assigns it; an in-progress or returned visit stays as it is
      return from === "scheduled" && hasInspector ? "assigned" : from;
    case "cancel":
      return from !== null && isChangeable(from) ? "cancelled" : null;
    case "start":
      return from === "assigned" || from === "scheduled" || from === "returned" ? "in_progress" : null;
  }
}

/**
 * What the app shows: a visit that has not started within `overdueHours` of its scheduled time is overdue.
 * Only visits still waiting to start can be overdue.
 */
export function effectiveStatus(v: { status: VisitStatus; date: string; time: string }, now: Date, overdueHours: number, timeZone: string): DisplayStatus {
  if (v.status !== "scheduled" && v.status !== "assigned") return v.status;
  const due = zonedInstant(v.date, v.time, timeZone).getTime() + overdueHours * 3_600_000;
  return now.getTime() > due ? "overdue" : v.status;
}
