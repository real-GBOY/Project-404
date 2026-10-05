import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/raqib";
import type { Inspection } from "@/api/types";
import { setUi } from "@/state/ui-store";
import { putWithProgress } from "@/lib/upload";
import type { Actions } from "@/presenters/actions";

/**
 * The application layer: each command calls the API, then invalidates exactly the server state it can have
 * changed (so every screen re-reads from the backend rather than patching local copies).
 */
export function useActions(): Actions {
  const qc = useQueryClient();
  return useMemo<Actions>(() => {
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const put = (visitId: string, view: Inspection) => {
      qc.setQueryData(["inspection", visitId], view);
      setUi({ savedAt: new Date().toTimeString().slice(0, 5) });
    };
    /** Show the text immediately; send it once the person pauses. Everything else is sent at once. */
    const optimistic = (visitId: string, fn: (v: Inspection) => Inspection) => {
      const cur = qc.getQueryData<Inspection>(["inspection", visitId]);
      if (cur) put(visitId, fn(cur));
    };
    return {
      async changeRole(id, role, reason) {
        await api.users.changeRole(id, role, reason);
        await qc.invalidateQueries({ queryKey: ["users"] });
      },
      async setScope(id, projectIds, reason) {
        await api.users.setScope(id, projectIds, reason);
        await qc.invalidateQueries({ queryKey: ["users"] });
      },
      async setStatus(id, status, reason) {
        await api.users.setStatus(id, status, reason);
        await qc.invalidateQueries({ queryKey: ["users"] });
      },
      async applyTemplates(changes, reason) {
        await api.permissions.apply(changes, reason);
        await qc.invalidateQueries({ queryKey: ["permissions"] });
        await qc.invalidateQueries({ queryKey: ["users"] });
      },
      async saveSettings(settings, reason) {
        await api.settings.update(settings, reason);
        await qc.invalidateQueries({ queryKey: ["settings"] });
      },
      async createVisit(input) {
        const v = await api.visits.create(input);
        await qc.invalidateQueries({ queryKey: ["visits"] });
        return { ref: v.ref, id: v.id };
      },
      async rescheduleVisit(id, input) {
        await api.visits.reschedule(id, input);
        await qc.invalidateQueries({ queryKey: ["visits"] });
      },
      async cancelVisit(id, reason) {
        await api.visits.cancel(id, reason);
        await qc.invalidateQueries({ queryKey: ["visits"] });
      },
      async markNotificationRead(id) {
        await api.notifications.markRead(id);
        await qc.invalidateQueries({ queryKey: ["notifications"] });
      },
      async markAllNotificationsRead() {
        await api.notifications.markAllRead();
        await qc.invalidateQueries({ queryKey: ["notifications"] });
      },
      async startInspection(visitId) {
        const v = await api.inspection.start(visitId);
        put(visitId, v);
        await qc.invalidateQueries({ queryKey: ["visits"] });
        return v;
      },
      async saveAnswer(visitId, itemId, patch) {
        optimistic(visitId, (v) => ({
          ...v,
          sections: v.sections.map((s) => ({ ...s, items: s.items.map((it) => (it.id === itemId ? { ...it, ...(patch.value !== undefined ? { answer: patch.value } : {}), ...(patch.note !== undefined ? { note: patch.note ?? "" } : {}), ...(patch.severity !== undefined ? { severity: patch.severity } : {}) } : it)) })),
        }));
        const send = async (): Promise<void> => {
          put(visitId, await api.inspection.answer(visitId, itemId, patch));
        };
        if (patch.note === undefined) return send();
        const key = `a:${itemId}`;
        clearTimeout(timers.get(key));
        await new Promise<void>((resolve, reject) => timers.set(key, setTimeout(() => send().then(() => resolve(), reject), 600)));
      },
      async setGuardScore(visitId, guardId, itemId, score) {
        optimistic(visitId, (v) => ({ ...v, guards: v.guards.map((g) => (g.guardId === guardId ? { ...g, scores: { ...g.scores, [itemId]: score } } : g)) }));
        put(visitId, await api.inspection.guardScore(visitId, guardId, itemId, score));
      },
      async setGuardNote(visitId, guardId, note) {
        optimistic(visitId, (v) => ({ ...v, guards: v.guards.map((g) => (g.guardId === guardId ? { ...g, note } : g)) }));
        const key = `g:${guardId}`;
        clearTimeout(timers.get(key));
        await new Promise<void>((resolve, reject) => timers.set(key, setTimeout(() => api.inspection.guardNote(visitId, guardId, note).then((v) => { put(visitId, v); resolve(); }, reject), 600)));
      },
      async submitInspection(visitId) {
        // flush any pending text first so the backend checks what the person sees
        for (const t of timers.values()) clearTimeout(t);
        const v = await api.inspection.submit(visitId);
        put(visitId, v);
        await qc.invalidateQueries({ queryKey: ["visits"] });
      },
      async uploadEvidence(file, target, onProgress) {
        const p = await api.evidence.presign({ name: file.name, type: file.type, size: file.size });
        await putWithProgress(file, p.upload, onProgress);
        await api.evidence.confirm(p.fileId);
        await api.evidence.attach({ fileId: p.fileId, inspectionId: target.inspectionId, itemId: target.itemId ?? null, guardId: target.guardId ?? null });
        put(target.visitId, await api.inspection.get(target.visitId));
      },
      async removeEvidence(visitId, evidenceId) {
        await api.evidence.remove(evidenceId);
        put(visitId, await api.inspection.get(visitId));
      },
      async assignAction(observationId, input) {
        const a = await api.actions.create(observationId, input);
        await Promise.all([qc.invalidateQueries({ queryKey: ["observations"] }), qc.invalidateQueries({ queryKey: ["actions"] })]);
        return a;
      },
      async actionStep(id, step, body) {
        qc.setQueryData(["action", id], await api.actions.step(id, step, body ?? {}));
        await Promise.all([qc.invalidateQueries({ queryKey: ["observations"] }), qc.invalidateQueries({ queryKey: ["actions"] })]);
      },
      async commentAction(id, text) {
        qc.setQueryData(["action", id], await api.actions.comment(id, text));
      },
      async uploadActionEvidence(file, actionId, onProgress) {
        const p = await api.evidence.presign({ name: file.name, type: file.type, size: file.size });
        await putWithProgress(file, p.upload, onProgress);
        await api.evidence.confirm(p.fileId);
        await api.evidence.attach({ fileId: p.fileId, actionId });
        qc.setQueryData(["action", actionId], await api.actions.get(actionId));
      },
      async removeActionEvidence(actionId, evidenceId) {
        await api.evidence.remove(evidenceId);
        qc.setQueryData(["action", actionId], await api.actions.get(actionId));
      },
      reportPdf: (id, lang) => api.reports.pdf(id, lang),
      evidenceBlob: (id) => api.evidence.blob(id),
      async decideReview(visitId, action, body) {
        put(visitId, await api.review.decide(visitId, action, body));
        await qc.invalidateQueries({ queryKey: ["visits"] });
      },
      async createForm(input) {
        const f = await api.forms.create(input);
        await qc.invalidateQueries({ queryKey: ["forms"] });
        return { id: f.id };
      },
      async createDraft(formId) {
        await api.forms.createDraft(formId);
        await qc.invalidateQueries({ queryKey: ["forms"] });
      },
      async saveDraft(formId, sections) {
        await api.forms.saveDraft(formId, sections);
        await qc.invalidateQueries({ queryKey: ["forms"] });
      },
      async discardDraft(formId) {
        await api.forms.discardDraft(formId);
        await qc.invalidateQueries({ queryKey: ["forms"] });
      },
      async publishForm(formId, reason) {
        await api.forms.publish(formId, reason);
        await qc.invalidateQueries({ queryKey: ["forms"] });
      },
      async setFormActive(formId, active, reason) {
        await api.forms.setActive(formId, active, reason);
        await qc.invalidateQueries({ queryKey: ["forms"] });
      },
    };
  }, [qc]);
}
