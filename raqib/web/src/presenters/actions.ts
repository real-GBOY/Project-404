import type { CreateVisitInput, OrgSettings, RescheduleVisitInput, RoleKey, TemplateChange } from "@/api/types";

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
}
