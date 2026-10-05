import type { Answer, CorrectiveAction, TrainingRequest, FormSection, Inspection, CreateVisitInput, OrgSettings, RescheduleVisitInput, RoleKey, TemplateChange } from "@/api/types";

/**
 * The application layer's commands: each is one user intention that the backend validates and
 * records. Implemented over `src/api` with query invalidation in `app/use-actions.ts`; presenters
 * only call these (they never touch HTTP). Every command that changes state requires a reason where the
 * approved design asks for one, and rejects with the backend's error on refusal.
 */
export interface Actions {
  changeRole(id: string, role: RoleKey, reason: string): Promise<void>;
  setScope(id: string, projectIds: string[], reason: string): Promise<void>;
  setStatus(id: string, status: "active" | "disabled", reason: string): Promise<void>;
  applyTemplates(changes: TemplateChange[], reason: string): Promise<void>;
  saveSettings(settings: OrgSettings, reason: string): Promise<void>;
  createVisit(input: CreateVisitInput): Promise<{ ref: string; id: string }>;
  rescheduleVisit(id: string, input: RescheduleVisitInput): Promise<void>;
  cancelVisit(id: string, reason: string): Promise<void>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(): Promise<void>;
  startInspection(visitId: string): Promise<Inspection>;
  /** Text edits are saved after a short pause; choices are saved immediately. The cache updates at once either way. */
  saveAnswer(visitId: string, itemId: string, patch: { value?: Answer; note?: string | null; severity?: "low" | "medium" | "high" | null }): Promise<void>;
  setGuardScore(visitId: string, guardId: string, itemId: string, score: number): Promise<void>;
  setGuardNote(visitId: string, guardId: string, note: string): Promise<void>;
  submitInspection(visitId: string): Promise<void>;
  /** presign → direct PUT with progress → confirm → link; resolves when the evidence is stored and linked. */
  uploadEvidence(file: File, target: { visitId: string; inspectionId: string; itemId?: string; guardId?: string }, onProgress: (pct: number) => void): Promise<void>;
  removeEvidence(visitId: string, evidenceId: string): Promise<void>;
  assignAction(observationId: string, input: { responsibleId: string; dueDate: string; priority: "low" | "medium" | "high"; description: string }): Promise<CorrectiveAction>;
  actionStep(id: string, step: "start" | "submit" | "return" | "close", body?: { reason?: string; comment?: string }): Promise<void>;
  commentAction(id: string, text: string): Promise<void>;
  uploadActionEvidence(file: File, actionId: string, onProgress: (pct: number) => void): Promise<void>;
  removeActionEvidence(actionId: string, evidenceId: string): Promise<void>;
  requestTraining(input: { guardId: string; reason: "low_score" | "repeat_issue" | "incident" | "refresher" | "new_assignment"; course: string; related: string; priority: "low" | "medium" | "high"; notes: string }): Promise<TrainingRequest>;
  trainingStep(id: string, step: "approve" | "return" | "reject" | "resubmit" | "schedule" | "complete", body?: Record<string, unknown>): Promise<void>;
  reportPdf(id: string, lang: "ar" | "en"): Promise<Blob>;
  evidenceBlob(id: string): Promise<Blob>;
  decideReview(visitId: string, action: "forward" | "return" | "reject" | "approve", body: { reason?: string; comment?: string; itemIds?: string[] }): Promise<void>;
  createForm(input: { code: string; category: "site" | "guard"; name: { ar: string; en: string } }): Promise<{ id: string }>;
  createDraft(formId: string): Promise<void>;
  saveDraft(formId: string, sections: FormSection[]): Promise<void>;
  discardDraft(formId: string): Promise<void>;
  publishForm(formId: string, reason: string): Promise<void>;
  setFormActive(formId: string, active: boolean, reason: string): Promise<void>;
}
