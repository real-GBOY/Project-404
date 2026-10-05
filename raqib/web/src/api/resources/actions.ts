import { ENDPOINTS } from "@/config";
import { http } from "@/services/http";
import { allPages } from "../paging";
import type { CorrectiveAction, ResponsibleOption, Severity } from "../types";

export const actionsApi = {
  list: () => allPages<CorrectiveAction>(ENDPOINTS.actions.list).then((r) => r.items),
  get: (id: string) => http<CorrectiveAction>(ENDPOINTS.actions.byId(id)),
  responsible: (projectId: string) =>
    http<{ items: ResponsibleOption[] }>(ENDPOINTS.actions.responsible(projectId)).then(
      (r) => r.items,
    ),
  create: (
    observationId: string,
    b: { responsibleId: string; dueDate: string; priority: Severity; description: string },
  ) =>
    http<CorrectiveAction>(ENDPOINTS.observations.action(observationId), {
      method: "POST",
      body: b,
    }),
  step: (
    id: string,
    step: "start" | "submit" | "return" | "close",
    body: { reason?: string; comment?: string } = {},
  ) => http<CorrectiveAction>(ENDPOINTS.actions.step(id, step), { method: "POST", body }),
  comment: (id: string, text: string) =>
    http<CorrectiveAction>(ENDPOINTS.actions.comments(id), { method: "POST", body: { text } }),
};
