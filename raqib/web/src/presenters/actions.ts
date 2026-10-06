import type {
  Answer,
  CorrectiveAction,
  TrainingRequest,
  FormSection,
  Inspection,
  CreateVisitInput,
  OrgSettings,
  RescheduleVisitInput,
  RoleKey,
  TemplateChange,
  L10n,
  Severity,
  Guard,
  GuardInput,
  ProjectInput,
} from "@/api/types";

/**
 * The application layer's commands: each is one user intention that the backend validates and
 * records. Implemented over `src/api` with query invalidation in `app/use-actions.ts`; presenters
 * only call these (they never touch HTTP). Every command that changes state requires a reason where the
 * approved design asks for one, and rejects with the backend's error on refusal.
 */
export interface Actions {
  createProject(input: ProjectInput): Promise<void>;
  updateProject(id: string, patch: Partial<Omit<ProjectInput, "code">>): Promise<void>;
  addSite(projectId: string, name: L10n): Promise<void>;
  renameSite(id: string, name: L10n): Promise<void>;
  archiveSite(id: string): Promise<void>;
  addArea(siteId: string, name: L10n): Promise<void>;
  archiveArea(id: string): Promise<void>;
  createGuard(input: GuardInput): Promise<void>;
  updateGuard(id: string, patch: Partial<Omit<GuardInput, "employeeNo">>): Promise<void>;
  setGuardStatus(id: string, status: Guard["status"]): Promise<void>;
  reassignAction(
    id: string,
    input: { responsibleId?: string; dueDate?: string; reason: string },
  ): Promise<void>;
  raiseObservation(input: {
    projectId: string;
    siteId: string;
    text: string;
    note?: string;
    severity: Severity;
  }): Promise<void>;
  updateProfile(
    id: string,
    patch: { name?: L10n; title?: L10n; phone?: string | null; employeeNo?: string | null },
  ): Promise<void>;
  resetMfa(id: string, reason: string): Promise<void>;
  exportPersonalData(id: string, fileName: string): Promise<void>;
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
  saveAnswer(
    visitId: string,
    itemId: string,
    patch: { value?: Answer; note?: string | null; severity?: "low" | "medium" | "high" | null },
  ): Promise<void>;
  setGuardScore(visitId: string, guardId: string, itemId: string, score: number): Promise<void>;
  setGuardNote(visitId: string, guardId: string, note: string): Promise<void>;
  /** `queued` = there is no connection: the submission is kept on the device and sent when it returns. */
  submitInspection(visitId: string): Promise<{ queued: boolean }>;
  /** presign → direct PUT with progress → confirm → link; resolves when the evidence is stored and linked. */
  uploadEvidence(
    file: File,
    target: { visitId: string; inspectionId: string; itemId?: string; guardId?: string },
    onProgress: (pct: number) => void,
  ): Promise<void>;
  removeEvidence(visitId: string, evidenceId: string): Promise<void>;
  assignAction(
    observationId: string,
    input: {
      responsibleId: string;
      dueDate: string;
      priority: "low" | "medium" | "high";
      description: string;
    },
  ): Promise<CorrectiveAction>;
  actionStep(
    id: string,
    step: "start" | "submit" | "return" | "close",
    body?: { reason?: string; comment?: string },
  ): Promise<void>;
  commentAction(id: string, text: string): Promise<void>;
  uploadActionEvidence(
    file: File,
    actionId: string,
    onProgress: (pct: number) => void,
  ): Promise<void>;
  removeActionEvidence(actionId: string, evidenceId: string): Promise<void>;
  requestTraining(input: {
    guardId: string;
    reason: "low_score" | "repeat_issue" | "incident" | "refresher" | "new_assignment";
    course: string;
    related: string;
    priority: "low" | "medium" | "high";
    notes: string;
  }): Promise<TrainingRequest>;
  trainingStep(
    id: string,
    step: "approve" | "return" | "reject" | "resubmit" | "schedule" | "complete",
    body?: Record<string, unknown>,
  ): Promise<void>;
  exportAnalytics(
    q: {
      period: string;
      from: string;
      to: string;
      projectId: string;
      siteId: string;
    },
    format: "csv" | "xlsx",
  ): Promise<void>;
  confSubmit(input: {
    kind: "misconduct" | "violation" | "safety";
    subject: string;
    body: string;
    place: string;
    identity: "named" | "confidential" | "anonymous";
    fileIds: string[];
  }): Promise<{ ref: string }>;
  confUpload(file: File, onProgress: (pct: number) => void): Promise<string>;
  confEnter(reason: string, ack: boolean): Promise<void>;
  confExit(): Promise<void>;
  confRespond(id: string, text: string): Promise<void>;
  confReveal(id: string, reason: string): Promise<void>;
  confIssueGrant(input: {
    userId: string;
    level: "view" | "respond";
    scope: "all" | "standard";
    reason: string;
    expiresAt: string;
  }): Promise<void>;
  confRevoke(id: string, reason: string): Promise<void>;
  exportAudit(
    q: {
      q: string;
      entity: string;
      actor: string;
      from: string;
      to: string;
    },
    format: "csv" | "xlsx",
  ): Promise<void>;
  approveRequest(
    id: string,
    input: { role: string; projectIds: string[]; comment?: string },
  ): Promise<void>;
  rejectRequest(id: string, reason: string): Promise<void>;
  resendRequest(id: string): Promise<void>;
  reportPdf(id: string, lang: "ar" | "en"): Promise<Blob>;
  evidenceBlob(id: string): Promise<Blob>;
  decideReview(
    visitId: string,
    action: "forward" | "return" | "reject" | "approve",
    body: { reason?: string; comment?: string; itemIds?: string[] },
  ): Promise<void>;
  renameForm(id: string, name: L10n): Promise<void>;
  createForm(input: {
    code: string;
    category: "site" | "guard";
    name: { ar: string; en: string };
  }): Promise<{ id: string }>;
  createDraft(formId: string): Promise<void>;
  saveDraft(formId: string, sections: FormSection[]): Promise<void>;
  discardDraft(formId: string): Promise<void>;
  publishForm(formId: string, reason: string): Promise<void>;
  setFormActive(formId: string, active: boolean, reason: string): Promise<void>;
}
