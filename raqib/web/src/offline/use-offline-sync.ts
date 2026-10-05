import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/raqib";
import type { Me } from "@/api/types";
import { putWithProgress } from "@/lib/upload";
import { setUi } from "@/state/ui-store";
import type { Executor } from "./outbox";
import { offline } from "./session";

/**
 * Wires the offline session to the application while someone is signed in: the executor that replays queued changes
 * against the API, the refresh of whatever those changes touched, and a background copy of the inspections an inspector is
 * in the middle of — so they can still be opened, and worked on, in a basement with no signal.
 */
export function useOfflineSync(me: Me): void {
  const qc = useQueryClient();

  useEffect(() => {
    void offline.setUser(me.id);
    const exec: Executor = {
      answer: async (op) => void (await api.inspection.answer(op.visitId, op.itemId, op.patch)),
      guardScore: async (op) =>
        void (await api.inspection.guardScore(op.visitId, op.guardId, op.itemId, op.score)),
      guardNote: async (op) =>
        void (await api.inspection.guardNote(op.visitId, op.guardId, op.note)),
      submit: async (op) => void (await api.inspection.submit(op.visitId)),
      evidence: async (op, file) => {
        const p = await api.evidence.presign({ name: file.name, type: file.type, size: file.size });
        await putWithProgress(file, p.upload, () => undefined);
        await api.evidence.confirm(p.fileId);
        await api.evidence.attach({
          fileId: p.fileId,
          inspectionId: op.inspectionId,
          itemId: op.itemId ?? null,
          guardId: op.guardId ?? null,
        });
      },
    };
    const stop = offline.start(exec, async (r) => {
      for (const v of r.visits) void qc.invalidateQueries({ queryKey: ["inspection", v] });
      void qc.invalidateQueries({ queryKey: ["visits"] });
      // uploads that have now gone out are real evidence in the refreshed view: drop their "waiting" chips
      const alive = new Set(
        (await offline.list()).flatMap((o) => (o.kind === "evidence" ? [o.blobKey] : [])),
      );
      setUi((s) => ({
        uploads: Object.fromEntries(
          Object.entries(s.uploads).map(([k, list]) => [
            k,
            list.filter((u) => !(u.status === "queued" && u.queueKey && !alive.has(u.queueKey))),
          ]),
        ),
      }));
    });
    return stop;
  }, [me.id, qc]);

  // keep a copy of the visits this person is working on, ready for the next time the signal drops
  useEffect(() => {
    if (me.role !== "ins") return;
    let live = true;
    void (async () => {
      try {
        const visits = await offline.withCache("visits", () => api.visits.list());
        for (const v of visits) {
          if (!live) return;
          if (v.inspector?.id !== me.id || !["in_progress", "returned"].includes(v.storedStatus))
            continue;
          await qc.prefetchQuery({
            queryKey: ["inspection", v.id],
            queryFn: () => offline.withCache(`inspection:${v.id}`, () => api.inspection.get(v.id)),
            staleTime: 60_000,
          });
        }
      } catch {
        // best effort: nothing to prepare when the network is down
      }
    })();
    return () => {
      live = false;
    };
  }, [me.id, me.role, qc]);
}
