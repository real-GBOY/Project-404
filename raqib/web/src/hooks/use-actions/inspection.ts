import { api } from "@/api";
import { uploadToStorage } from "@/api/uploads";
import type { Inspection } from "@/api/types";
import { isNetworkError, QueuedUpload, type Op } from "@/services/offline/outbox";
import { offline } from "@/services/offline/session";
import { getUi } from "@/state/ui-store";
import { QK } from "../query-keys";
import { invalidate, putInspection, type Qc, type Slice } from "./shared";

/** Text is sent once the person pauses typing; everything else is sent at once. */
const TYPING_PAUSE_MS = 600;

/**
 * Working an inspection: answers, guard evaluations, evidence, submit. Every change shows on screen immediately
 * (optimistic) and is sent now, or kept on the device when there is no connection (see `sendOrQueue`).
 */
export const inspectionActions = (
  qc: Qc,
): Slice<
  | "startInspection"
  | "saveAnswer"
  | "setGuardScore"
  | "setGuardNote"
  | "submitInspection"
  | "uploadEvidence"
  | "removeEvidence"
> => {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const put = (visitId: string, view: Inspection) => putInspection(qc, visitId, view);

  /** Show an edit at once, before the server has answered. */
  const optimistic = (visitId: string, fn: (v: Inspection) => Inspection) => {
    const cur = qc.getQueryData<Inspection>([QK.inspection, visitId, getUi().formId]);
    if (cur) put(visitId, fn(cur));
  };

  /**
   * Send a change now, or keep it on the device when there is no connection (or earlier changes for this visit are still
   * waiting, so the order is kept). A refusal from the server is still an error; only an unreachable network queues.
   */
  const sendOrQueue = async (
    visitId: string,
    op: Op,
    send: () => Promise<void>,
  ): Promise<"sent" | "queued"> => {
    if (await offline.shouldQueue(visitId)) {
      await offline.queue(op);
      return "queued";
    }
    try {
      await send();
      return "sent";
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      offline.reportNetworkFailure();
      await offline.queue(op);
      return "queued";
    }
  };

  /** Run `send` once the person has stopped typing in this field. */
  const afterPause = (key: string, send: () => Promise<unknown>): Promise<void> => {
    clearTimeout(timers.get(key));
    return new Promise<void>((resolve, reject) =>
      timers.set(
        key,
        setTimeout(() => send().then(() => resolve(), reject), TYPING_PAUSE_MS),
      ),
    );
  };

  return {
    async startInspection(visitId, formId) {
      if (!offline.isOnline()) throw new Error("offline");
      const v = await api.inspection.start(visitId, formId);
      put(visitId, v);
      await invalidate(qc, QK.visits, QK.visitForms);
      return v;
    },

    async saveAnswer(visitId, itemId, patch) {
      optimistic(visitId, (v) => ({
        ...v,
        sections: v.sections.map((s) => ({
          ...s,
          items: s.items.map((it) =>
            it.id === itemId
              ? {
                  ...it,
                  ...(patch.value !== undefined ? { answer: patch.value } : {}),
                  ...(patch.note !== undefined ? { note: patch.note ?? "" } : {}),
                  ...(patch.severity !== undefined ? { severity: patch.severity } : {}),
                }
              : it,
          ),
        })),
      }));
      const send = () =>
        sendOrQueue(visitId, { kind: "answer", visitId, itemId, patch }, async () =>
          put(visitId, await api.inspection.answer(visitId, itemId, patch)),
        );
      // a refusal from the server (not a lost connection) puts the screen back to what the server holds
      const guarded = async () => {
        try {
          await send();
        } catch (err) {
          if (!isNetworkError(err)) await invalidate(qc, QK.inspection);
          throw err;
        }
      };
      if (patch.note === undefined) return void (await guarded());
      return afterPause(`a:${itemId}`, guarded);
    },

    async setGuardScore(visitId, guardId, itemId, score) {
      optimistic(visitId, (v) => ({
        ...v,
        guards: v.guards.map((g) =>
          g.guardId === guardId ? { ...g, scores: { ...g.scores, [itemId]: score } } : g,
        ),
      }));
      await sendOrQueue(
        visitId,
        { kind: "guardScore", visitId, guardId, itemId, score },
        async () => put(visitId, await api.inspection.guardScore(visitId, guardId, itemId, score)),
      );
    },

    async setGuardNote(visitId, guardId, note) {
      optimistic(visitId, (v) => ({
        ...v,
        guards: v.guards.map((g) => (g.guardId === guardId ? { ...g, note } : g)),
      }));
      return afterPause(`g:${guardId}`, () =>
        sendOrQueue(visitId, { kind: "guardNote", visitId, guardId, note }, async () =>
          put(visitId, await api.inspection.guardNote(visitId, guardId, note)),
        ),
      );
    },

    async submitInspection(visitId) {
      // text still waiting for the typing pause is dropped: the backend checks what is already saved
      for (const t of timers.values()) clearTimeout(t);
      const how = await sendOrQueue(visitId, { kind: "submit", visitId }, async () => {
        put(visitId, await api.inspection.submit(visitId));
        await invalidate(qc, QK.visits);
      });
      return { queued: how === "queued" };
    },

    async uploadEvidence(file, target, onProgress) {
      const link = {
        inspectionId: target.inspectionId,
        itemId: target.itemId ?? null,
        guardId: target.guardId ?? null,
      };
      // no connection: keep the file on the device; it uploads and attaches itself when the connection returns
      const keep = async (): Promise<never> => {
        const q = await offline.queueFile(
          file,
          { visitId: target.visitId, ...link },
          file.name,
          file.type,
        );
        throw new QueuedUpload((q as Extract<Op, { kind: "evidence" }>).blobKey);
      };
      if (await offline.shouldQueue(target.visitId)) return keep();
      try {
        const fileId = await uploadToStorage(file, onProgress);
        await api.evidence.attach({ fileId, ...link });
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        offline.reportNetworkFailure();
        return keep();
      }
      put(target.visitId, await api.inspection.get(target.visitId, getUi().formId || undefined));
    },

    async removeEvidence(visitId, evidenceId) {
      await api.evidence.remove(evidenceId);
      put(visitId, await api.inspection.get(visitId, getUi().formId || undefined));
    },
  };
};
