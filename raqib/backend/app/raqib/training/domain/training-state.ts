/**
 * Training request lifecycle as pure functions.
 *
 *   pending_pm --approve--> approved        (project manager)
 *   pending_pm --return-->  returned        (reason required; the requester edits and resubmits)
 *   pending_pm --reject-->  rejected        (final, reason required)
 *   returned   --resubmit--> pending_pm
 *   approved   --schedule--> scheduled      (quality)
 *   scheduled  --complete--> completed      (quality records the result; final)
 */
export const TRAINING_STATUSES = ["pending_pm", "returned", "rejected", "approved", "scheduled", "completed"] as const;
export type TrainingStatus = (typeof TRAINING_STATUSES)[number];
export type TrainingStep = "approve" | "return" | "reject" | "resubmit" | "schedule" | "complete";

export function nextTraining(from: TrainingStatus, step: TrainingStep): TrainingStatus | null {
  switch (step) {
    case "approve":
      return from === "pending_pm" ? "approved" : null;
    case "return":
      return from === "pending_pm" ? "returned" : null;
    case "reject":
      return from === "pending_pm" ? "rejected" : null;
    case "resubmit":
      return from === "returned" ? "pending_pm" : null;
    case "schedule":
      return from === "approved" ? "scheduled" : null;
    case "complete":
      return from === "scheduled" ? "completed" : null;
  }
}

/** The permission letter (module `training`) each step needs. */
export const letterForTraining = (step: TrainingStep): "P" | "E" | "R" =>
  step === "approve" || step === "return" || step === "reject" ? "P" : step === "resubmit" ? "E" : "R";

/** Waiting for the manager longer than this many days is flagged as escalated (derived, never stored). */
export const ESCALATE_AFTER_DAYS = 3;
export const isEscalated = (status: TrainingStatus, waitingSince: string, today: string): boolean =>
  status === "pending_pm" && (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${waitingSince.slice(0, 10)}T00:00:00Z`)) / 86_400_000 >= ESCALATE_AFTER_DAYS;
