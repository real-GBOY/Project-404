import type { Inspection } from "@/api/types";
import type { Op } from "./outbox";

/**
 * Show a queued change on an inspection exactly as the server will once it accepts it, so the form keeps behaving
 * while offline (and does not jump back when the screen re-reads the last server copy while changes still wait).
 * Pure: returns a new view. Evidence and submit are not visible in the view until the server has them.
 */
export function applyOp(v: Inspection, op: Op): Inspection {
  if (op.kind === "answer") {
    const p = op.patch;
    return {
      ...v,
      sections: v.sections.map((s) => ({
        ...s,
        items: s.items.map((it) =>
          it.id === op.itemId
            ? {
                ...it,
                ...(p.value !== undefined ? { answer: p.value } : {}),
                ...(p.note !== undefined ? { note: p.note ?? "" } : {}),
                ...(p.severity !== undefined ? { severity: p.severity } : {}),
              }
            : it,
        ),
      })),
    };
  }
  if (op.kind === "guardScore")
    return {
      ...v,
      guards: v.guards.map((g) =>
        g.guardId === op.guardId ? { ...g, scores: { ...g.scores, [op.itemId]: op.score } } : g,
      ),
    };
  if (op.kind === "guardNote")
    return {
      ...v,
      guards: v.guards.map((g) => (g.guardId === op.guardId ? { ...g, note: op.note } : g)),
    };
  return v;
}

export const applyOps = (v: Inspection, ops: Op[]): Inspection => ops.reduce(applyOp, v);
