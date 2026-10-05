/**
 * The corrective-action lifecycle as pure functions. One table of legal moves, so a transition is validated in
 * exactly one place. `overdue` is derived from the due date, never stored.
 *
 *   assigned | returned --start--> in_progress
 *   in_progress --submit--> quality_review          (needs closure evidence)
 *   quality_review --return--> returned             (reason required)
 *   quality_review --close--> closed                (final)
 */
export const ACTION_STATUSES = ["assigned", "in_progress", "quality_review", "returned", "closed"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];
export type DisplayActionStatus = ActionStatus | "overdue";
export type ActionStep = "start" | "submit" | "return" | "close";

export function nextAction(from: ActionStatus, step: ActionStep): ActionStatus | null {
  switch (step) {
    case "start": return from === "assigned" || from === "returned" ? "in_progress" : null;
    case "submit": return from === "in_progress" ? "quality_review" : null;
    case "return": return from === "quality_review" ? "returned" : null;
    case "close": return from === "quality_review" ? "closed" : null;
  }
}

/** The permission letter (module `actions`) each step needs: the responsible person works (S), quality reviews (R) and closes (P). */
export const letterForStep = (step: ActionStep): "S" | "R" | "P" => (step === "return" ? "R" : step === "close" ? "P" : "S");

/** Work not yet handed to quality review is overdue once its due date has passed (the due day itself is still on time). */
export function effectiveActionStatus(status: ActionStatus, dueDate: string, today: string): DisplayActionStatus {
  return (status === "assigned" || status === "in_progress" || status === "returned") && dueDate < today ? "overdue" : status;
}

/** States in which the responsible person may add or remove closure evidence. */
export const evidenceOpen = (status: ActionStatus): boolean => status === "in_progress";
