/**
 * Training request lifecycle as pure functions.
 *
 *   A request from a SUPERVISOR starts with the project manager; one from a GUARD starts with a supervisor (unless the
 *   organization turns that review off in settings) and then goes to the project manager. After approval the request
 *   is with Quality Management, which schedules the training and records the result.
 *
 *   pending_supervisor --review--> pending_pm        (supervisor forwards a guard\'s request)
 *   pending_supervisor --return--> returned          (reason required)
 *   pending_supervisor --reject--> rejected          (final, reason required)
 *   pending_pm --approve--> approved                 (project manager; the request is now submitted to Quality Management)
 *   pending_pm --return-->  returned                 (reason required; the requester edits and resubmits)
 *   pending_pm --reject-->  rejected                 (final, reason required)
 *   returned   --resubmit--> the stage the request started in
 *   approved   --schedule--> scheduled               (quality)
 *   scheduled  --complete--> completed               (quality records the result; final)
 */
export const TRAINING_STATUSES = ["pending_supervisor", "pending_pm", "returned", "rejected", "approved", "scheduled", "completed"] as const;
export type TrainingStatus = (typeof TRAINING_STATUSES)[number];
export type TrainingStep = "review" | "approve" | "return" | "reject" | "resubmit" | "schedule" | "complete";
export type RequesterKind = "supervisor" | "guard";

/** Where a new (or resubmitted) request waits first. */
export function initialStatus(kind: RequesterKind, guardReviewBySupervisor: boolean): "pending_supervisor" | "pending_pm" {
  return kind === "guard" && guardReviewBySupervisor ? "pending_supervisor" : "pending_pm";
}

export function nextTraining(from: TrainingStatus, step: TrainingStep, start: "pending_supervisor" | "pending_pm" = "pending_pm"): TrainingStatus | null {
  switch (step) {
    case "review":
      return from === "pending_supervisor" ? "pending_pm" : null;
    case "approve":
      return from === "pending_pm" ? "approved" : null;
    case "return":
      return from === "pending_pm" || from === "pending_supervisor" ? "returned" : null;
    case "reject":
      return from === "pending_pm" || from === "pending_supervisor" ? "rejected" : null;
    case "resubmit":
      return from === "returned" ? start : null;
    case "schedule":
      return from === "approved" ? "scheduled" : null;
    case "complete":
      return from === "scheduled" ? "completed" : null;
  }
}

/**
 * The permission letter (module `training`) a step needs. A supervisor\'s stage needs S (submit/review), the project
 * manager\'s stage needs P (approve), quality\'s stage needs R. Which stage it is decides the letter for return and reject.
 */
export function letterForTraining(step: TrainingStep, from: TrainingStatus): "S" | "P" | "E" | "R" {
  if (step === "review") return "S";
  if (step === "return" || step === "reject") return from === "pending_supervisor" ? "S" : "P";
  if (step === "approve") return "P";
  if (step === "resubmit") return "E";
  return "R";
}

/** Waiting for the manager longer than this many days is flagged as escalated (derived, never stored). */
export const ESCALATE_AFTER_DAYS = 3;
export const isEscalated = (status: TrainingStatus, waitingSince: string, today: string): boolean =>
  (status === "pending_pm" || status === "pending_supervisor") &&
  (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${waitingSince.slice(0, 10)}T00:00:00Z`)) / 86_400_000 >= ESCALATE_AFTER_DAYS;
