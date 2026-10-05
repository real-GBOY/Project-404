import type { Inspection, InspectionItem, Visit } from "@/api/types";
import { badge, scoreColor } from "../common";
import type { Ctx } from "../context";
import { openEvidence } from "../viewer";
import { openAssign } from "./actions";
import { ROLE_LABEL } from "./users";
import { timeline, visitRow } from "./visits";
import { C } from "@/styles/colors";

const flagKey = (visitId: string, itemId: string) => `${visitId}:${itemId}`;

/** Evidence chips on the review screen — opening one shows the file through the authorized viewer. */
function evidenceChips(c: Ctx, insp: Inspection, it: InspectionItem) {
  const { i } = c;
  return it.evidence.map((e) => ({
    name: e.name,
    kindLabel: e.kind === "video" ? i.S("evVideo") : e.kind === "doc" ? i.S("evDoc") : i.S("evPhoto"),
    hasUrl: false, bgImg: "none",
    open: () => openEvidence(c, e, `${insp.ref} · ${it.num} ${i.L(it.text)}`),
  }));
}

/** The review screen (design: vmReview + vmReviewExt) over the backend's inspection read model. */
export function reviewDetail(c: Ctx, insp: Inspection, v: Visit) {
  const { i, ui, set, me } = c;
  const p = me.permissions.inspections;
  const pend = v.storedStatus === "pending_review" || v.storedStatus === "pending_approval";
  const isOwn = v.inspector?.id === me.id;
  const canDecide = pend && !isOwn && ((v.storedStatus === "pending_review" && p.includes("R")) || (v.storedStatus === "pending_approval" && p.includes("P")));
  const flags = insp.sections.flatMap((s) => s.items).filter((it) => ui.rflags[flagKey(v.id, it.id)]);
  const guards = new Map((c.data.guards ?? []).map((g) => [g.id, g]));
  const last = (a: string) => v.history.filter((h) => h.action === a).pop();
  const roleName = (r: string | null) => (r ? i.L(ROLE_LABEL[r as keyof typeof ROLE_LABEL]) : "");

  const sections = insp.sections.map((sec, si) => {
    let num = 0;
    let den = 0;
    const items = sec.items.map((it) => {
      if (it.answer === "c") { num += it.weight; den += it.weight; } else if (it.answer === "n") den += it.weight;
      const ans = it.answer === "c" ? badge(i.S("ans_c"), "ok") : it.answer === "n" ? badge(i.S("ans_n"), "bad") : it.answer === "x" ? badge(i.S("ans_x"), "neu") : badge(i.S("ans_none"), "warn");
      const ev = evidenceChips(c, insp, it);
      const obs = (c.data.observations ?? []).find((o) => o.visit?.id === v.id && o.itemKey === it.key);
      return {
        num: it.num, text: i.L(it.text), w: i.S("weight", { w: it.weight }),
        pts: it.answer === "c" ? `${it.weight}/${it.weight}` : it.answer === "n" ? `0/${it.weight}` : "—", ans,
        note: it.note, hasNote: !!it.note, ev, hasEv: ev.length > 0, bg: it.answer === "n" ? C.status.danger.bgFaint : C.surface.white,
        canFlag: canDecide, flag: !!ui.rflags[flagKey(v.id, it.id)],
        onFlag: () => set((s) => ({ rflags: { ...s.rflags, [flagKey(v.id, it.id)]: !s.rflags[flagKey(v.id, it.id)] } })),
        canCA: !!obs && !obs.action && me.permissions.actions.includes("A"), mkCA: () => obs && openAssign(c, obs),
        hasCA: !!obs?.action, caRef: obs?.action?.ref ?? "", caSt: obs?.action ? i.S(({ assigned: "cs_assigned", in_progress: "cs_in_progress", quality_review: "cs_under_review", returned: "cs_returned", closed: "cs_closed", overdue: "overdue" } as Record<string, string>)[obs.action.status]!) : "",
        goCA: () => obs?.action && c.go("action", obs.action.id),
      };
    });
    const pct = den ? Math.round((num / den) * 100) : null;
    return { title: `${si + 1}. ${i.L(sec.title)}`, scoreTxt: pct == null ? "—" : `${pct}%`, scoreC: scoreColor(pct), items };
  });

  const gv = insp.guards.map((g) => {
    const info = guards.get(g.guardId);
    return {
      name: info ? i.L(info.name) : g.guardId, emp: info?.employeeNo ?? "", score: g.pct == null ? "—" : `${g.pct}%`, scoreC: scoreColor(g.pct), note: g.note || "—",
      result: g.pct == null ? i.S("notEvaluated") : g.pct >= 80 ? i.S("g_good") : g.pct >= 60 ? i.S("g_ok") : i.S("g_poor"),
    };
  });

  let ro = "";
  if (!canDecide) {
    if (isOwn) ro = i.S("ro_inspector");
    else if (v.storedStatus === "pending_approval" && !p.includes("P") && p.includes("R")) ro = i.S("ro_needApprove");
    else if (v.storedStatus === "approved") ro = i.S("ro_approved");
    else if (v.storedStatus === "rejected") ro = i.S("ro_rejected");
    else if (v.storedStatus === "returned") ro = i.S("ro_returned");
    else if (!p.includes("R") && !p.includes("P")) ro = i.S("ro_inspector");
    else ro = i.S("ro_other");
  }

  const st = v.storedStatus;
  const idx = ({ pending_review: 1, pending_approval: 2, approved: 4, rejected: -1, returned: 0 } as Record<string, number>)[st] ?? 0;
  const stages = ([["submitted", 0], ["review", 1], ["approval", 2], ["approved", 3]] as const).map(([k, n]) => {
    const done = idx > n || st === "approved";
    const now = idx === n;
    const bad = st === "rejected" && n === (v.history.some((h) => h.action === "reviewed") ? 2 : 1);
    return { l: i.S(`stg_${k}`), c: bad ? C.status.danger.fg : done ? C.status.success.fg : now ? C.status.review.fg : C.border.strong, fg: bad || done || now ? C.text.ink : C.text.muted, fw: now || bad ? "600" : "500", sub: now ? i.S("stg_now") : bad ? i.S("vs_rejected") : "" };
  });
  const stageNote = st === "pending_review" ? i.S("stageReview") : st === "pending_approval" ? i.S("stageApproval") : "";

  const byId = new Map(insp.sections.flatMap((s) => s.items).map((it) => [it.id, it]));
  const prev = insp.previous.flatMap((pv) => pv.itemIds).map((id) => byId.get(id)).filter((x): x is InspectionItem => !!x).map((it) => ({
    num: it.num, text: i.L(it.text), req: "", now: it.answer === "c" ? i.S("ans_c") : it.answer === "n" ? i.S("ans_n") : it.answer === "x" ? i.S("ans_x") : "—", note: it.note,
  }));
  const lastDecision = v.history.filter((h) => ["returned", "rejected", "approved", "reviewed"].includes(h.action)).pop();
  const sub = v.history.filter((h) => h.action === "submitted" || h.action === "resubmitted").pop();
  const reviewed = st === "pending_approval" ? last("reviewed") : undefined;
  const sc = insp.score;

  return {
    rv: {
      ...visitRow(c, v),
      title: `${i.L(v.site.name)} — ${v.area == null ? "—" : i.L(v.area)}`,
      submitted: sub ? i.S("submittedBy", { u: i.L(sub.actor.name), t: i.fd(sub.at, "dt") }) : "",
      formTag: `${insp.form.code} · v${insp.form.version}`,
      sections, guards: gv, hasGuards: gv.length > 0,
      stats: [[i.S("st_score"), sc.pct == null ? "—" : `${sc.pct}%`], [i.S("ans_c"), String(sc.compliant)], [i.S("ans_n"), String(sc.nonCompliant)], [i.S("ans_x"), String(sc.na)], [i.S("st_evidence"), String(sc.evidence)]].map(([k, val]) => ({ k, v: val })),
      scoreC: scoreColor(sc.pct), canDecide, readOnly: !canDecide, roMsg: ro,
      hint: st === "pending_review" ? (p.includes("P") ? i.S("hint_qmReview") : i.S("hint_qeReview")) : i.S("hint_approve"),
      canApprove: canDecide && st === "pending_approval", canForward: canDecide && st === "pending_review",
      noApproveNote: canDecide && st === "pending_review", flagTxt: i.S("flagCount", { n: flags.length }), hasFlags: flags.length > 0,
      approve: () => c.openModal("approve", { vid: v.id, ref: v.ref, summary: i.S("m_summary", { p: sc.pct ?? "—", c: sc.compliant, n: sc.nonCompliant, e: sc.evidence }) }),
      forward: () => c.openModal("forward", { vid: v.id, ref: v.ref }),
      ret: () => c.openModal("return", { vid: v.id, ref: v.ref, flags: flags.map((f) => ({ id: f.id, num: f.num, text: i.L(f.text) })) }),
      reject: () => c.openModal("reject", { vid: v.id, ref: v.ref }),
      timeline: timeline(c, v), hasReport: !!c.data.reports?.items.some((x) => x.visitId === v.id), report: () => c.go("report", v.id),
      back: () => c.go(p.includes("R") || p.includes("P") ? "reviews" : "visit", p.includes("R") || p.includes("P") ? null : v.id),
      reviewedNote: reviewed?.reason ?? "", hasReviewedNote: !!reviewed?.reason, reviewedBy: reviewed ? i.S("reviewedBy", { u: i.L(reviewed.actor.name) }) : "",
      stages, stageNote, hasStageNote: !!stageNote,
      retExplain: i.S("explainReturn"), rejExplain: i.S("explainReject"), fwdExplain: i.S("explainForward"), appExplain: i.S("explainApprove"),
      round: i.S("roundN", { n: insp.round }), isResub: insp.round > 1 && prev.length > 0, prev,
      prevReason: v.history.filter((h) => h.action === "returned").pop()?.reason ?? "",
      decMeta: lastDecision ? i.S("decMeta", { d: i.S(`h_${lastDecision.action}`), u: i.L(lastDecision.actor.name), r: roleName(lastDecision.actor.role), t: i.fd(lastDecision.at, "dt") }) : "",
      isRejected: st === "rejected", rejReason: v.history.filter((h) => h.action === "rejected").pop()?.reason ?? "",
      verGo: () => undefined, canVer: false, immutable: i.S("immutableHist"),
    },
  };
}
