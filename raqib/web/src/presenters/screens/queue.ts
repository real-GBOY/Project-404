import type { DisplayStatus } from "@/api/types";
import { scoreColor } from "../common";
import type { Ctx } from "../context";
import { visitRow } from "./visits";
import { C } from "@/styles/colors";

/**
 * "My inspections" (inspector) and the review queue share one screen (design: vmReviews). Tabs filter the visits the
 * backend already scoped to the caller.
 */
export function reviewQueue(c: Ctx, mine: boolean) {
  const { i, ui, set, data, me } = c;
  const vis = data.visits ?? [];
  const T: Record<string, DisplayStatus[]> = mine
    ? {
        active: ["in_progress"],
        returned: ["returned"],
        submitted: ["pending_review", "pending_approval"],
        decided: ["approved", "rejected"],
      }
    : {
        pending_review: ["pending_review"],
        pending_approval: ["pending_approval"],
        returned: ["returned"],
        decided: ["approved", "rejected"],
      };
  const current = mine ? ui.itab : ui.rtab;
  const tk = T[current] ? current : Object.keys(T)[0]!;
  const tabs = Object.keys(T).map((k) => {
    const n = vis.filter((v) => T[k]!.includes(v.status)).length;
    const on = k === tk;
    return {
      label: i.S(`rt_${k}`),
      n: String(n),
      go: () => set(mine ? { itab: k } : { rtab: k }),
      fg: on ? C.text.ink : C.text.secondary,
      bd: on ? C.brand.primary : "transparent",
      fw: on ? "600" : "500",
    };
  });
  const rows = vis
    .filter((v) => T[tk]!.includes(v.status))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((v) => {
      const last = v.history[v.history.length - 1];
      const ago = last ? i.days(last.at, `${me.today}T00:00`) : 0;
      return {
        ...visitRow(c, v),
        nc: v.nonCompliant == null ? "—" : String(v.nonCompliant),
        ev: v.evidence == null ? "—" : String(v.evidence),
        score: v.scorePct == null ? "—" : `${v.scorePct}%`,
        scoreC: scoreColor(v.scorePct),
        at: last ? i.fd(last.at, "dt") : "—",
        age: ago <= 0 ? i.S("today") : ago === 1 ? i.S("yesterday") : i.S("daysAgo", { n: ago }),
        lastBy: last ? i.L(last.actor.name) : "—",
        go: () =>
          mine
            ? ["in_progress", "returned"].includes(v.status)
              ? c.go("inspect", v.id, { step: 0 })
              : c.go("visit", v.id)
            : c.go("review", v.id),
      };
    });
  return {
    rq: {
      tabs,
      rows,
      has: !!rows.length,
      none: !rows.length,
      title: mine
        ? (i.t.nav_inspections_ins ?? i.L({ ar: "تفتيشاتي", en: "My inspections" }))
        : i.L({ ar: "المراجعة والاعتماد", en: "Review & approval" }),
      sub: mine ? i.S("mineSub") : me.role === "qe" ? i.S("rqSubQE") : i.S("rqSubQM"),
      emptyTxt: i.S(`rqEmpty_${tk}`),
    },
  };
}
