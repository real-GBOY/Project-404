import type { Guard, GuardHistory, TrainingRequest, TrainingStatus } from "@/api/types";
import { ApiError } from "@/services/http";
import { TONE, badge, scoreColor } from "../common";
import type { Ctx } from "../context";
import { ROLE_LABEL } from "./users";
import { C } from "@/styles/colors";

const ST_TONE: Record<TrainingStatus, string> = {
  pending_supervisor: "rev",
  pending_pm: "rev",
  returned: "warn",
  rejected: "bad",
  approved: "info",
  scheduled: "info",
  completed: "ok",
};
const ST_KEY: Record<TrainingStatus, string> = {
  pending_supervisor: "trs_pending_supervisor",
  pending_pm: "trs_pending",
  returned: "trs_returned",
  rejected: "trs_rejected",
  approved: "trs_approved",
  scheduled: "trs_in_progress",
  completed: "trs_completed",
};
const PRI_TONE = { low: "neu", medium: "warn", high: "bad" } as const;
const REASONS = ["low_score", "repeat_issue", "incident", "refresher", "new_assignment"] as const;
const PROVIDERS = ["internal", "academy", "external"] as const;
const RESULTS = ["passed", "attended", "failed"] as const;
const FILTERS = [
  "all",
  "pending_supervisor",
  "pending_pm",
  "returned",
  "approved",
  "scheduled",
  "completed",
  "rejected",
] as const;

const stBadge = (c: Ctx, s: TrainingStatus) => badge(c.i.S(ST_KEY[s]), ST_TONE[s]);
const chip = (label: string, on: boolean, go: () => void) => ({
  label,
  go,
  bg: on ? C.text.ink : C.surface.white,
  fg: on ? C.surface.white : C.text.body,
  bd: on ? C.text.ink : C.border.input,
});
const fail = (c: Ctx) => (e: unknown) =>
  c.toast(e instanceof ApiError ? e.message : c.i.S("actionFailed"));

export function trainingList(c: Ctx) {
  const { i, ui, set, me } = c;
  const all = c.data.training ?? [];
  const f = (FILTERS as readonly string[]).includes(ui.tfilter) ? ui.tfilter : "all";
  const rows = all
    .filter((t) => f === "all" || t.status === f)
    .map((t) => ({
      ref: t.ref,
      esc: t.escalated,
      course: t.course,
      who: i.L(t.guard.name),
      emp: t.guard.employeeNo,
      proj: i.L(t.project.name),
      reason: i.S(`trr_${t.reason}`),
      at: i.fd(t.createdAt, "d"),
      pri: badge(i.S(`pri_${t.priority}`), PRI_TONE[t.priority]),
      st: stBadge(c, t.status),
      go: () => c.go("trainingD", t.id),
    }));
  return {
    tl: {
      canAdd: me.permissions.training.includes("A"),
      add: () => openRequest(c, null),
      chips: FILTERS.map((k) =>
        chip(
          `${k === "all" ? i.S("all") : i.S(ST_KEY[k as TrainingStatus])} ${k === "all" ? all.length : all.filter((t) => t.status === k).length}`,
          f === k,
          () => set({ tfilter: k }),
        ),
      ),
      rows,
      has: rows.length > 0,
      none: rows.length === 0,
    },
  };
}

/** Open the "request training" dialog, optionally for a given guard. */
export function openRequest(c: Ctx, guard: Guard | null): void {
  c.openModal(
    "tr",
    {},
    {
      g: guard?.id ?? (c.me.role === "guard" ? "self" : ""),
      reason2: "low_score",
      course: "",
      related: "",
      pri: "medium",
      notes: "",
    },
  );
}

export function trainingDetail(c: Ctx, t: TrainingRequest) {
  const { i, ui, set, me } = c;
  const p = me.permissions.training;
  const own = t.requestedById === me.id;
  const log = t.log ?? [];
  const roleName = (r: string | null) => (r ? i.L(ROLE_LABEL[r as keyof typeof ROLE_LABEL]) : "");
  // the supervisor decides a guard's request first (needs S), then the project manager (needs P)
  const atSupervisor = t.status === "pending_supervisor";
  const canDecide =
    !own && ((t.status === "pending_pm" && p.includes("P")) || (atSupervisor && p.includes("S")));
  const isGS = t.status === "returned" && own && p.includes("E");
  const canSched = t.status === "approved" && p.includes("R");
  const canDone = t.status === "scheduled" && p.includes("R");
  const order: TrainingStatus[] = ["pending_pm", "approved", "scheduled", "completed"];
  const idx =
    t.status === "returned" || t.status === "rejected" || atSupervisor
      ? 0
      : order.indexOf(t.status);
  const stepLabels = [
    i.S("tr_created"),
    i.S("tr_approved"),
    i.S("tr_scheduled"),
    i.S("tr_completed"),
  ];
  const steps = stepLabels.map((label, n) => {
    const done =
      n < idx ||
      (n === idx && t.status === "completed") ||
      (n === 0 && t.status !== "pending_pm" && t.status !== "returned" && !atSupervisor);
    const now = n === idx && !done;
    const bad = t.status === "rejected" && n === 1;
    return {
      label: bad ? i.S("tr_rejected") : label,
      dot: bad ? C.status.danger.fg : done ? C.status.success.fg : C.surface.white,
      dbd: bad
        ? C.status.danger.fg
        : done
          ? C.status.success.fg
          : now
            ? C.brand.primary
            : C.border.strong,
      mark: bad ? "✕" : done ? "✓" : "",
      fw: now || bad ? "600" : "500",
      fg: done || now || bad ? C.text.ink : C.text.muted,
      sub: now ? i.S("stg_now") : "",
    };
  });
  const hist = log.map((l) => ({
    label: i.S(`tr_${l.kind === "requested" ? "created" : l.kind}`),
    actor: i.L(l.actor.name),
    role: roleName(l.actor.role),
    at: i.fd(l.at, "dt"),
    reason: l.text ?? "",
    hasReason: !!l.text,
    c:
      l.kind === "completed" || l.kind === "approved"
        ? TONE.ok![0]
        : l.kind === "rejected"
          ? TONE.bad![0]
          : l.kind === "returned"
            ? TONE.warn![0]
            : TONE.info![0],
  }));
  return {
    td: {
      back: () => c.go("training"),
      ref: t.ref,
      st: stBadge(c, t.status),
      pri: badge(i.S(`pri_${t.priority}`), PRI_TONE[t.priority]),
      esc: t.escalated,
      course: t.course,
      who: i.L(t.guard.name),
      emp: t.guard.employeeNo,
      proj: i.L(t.project.name),
      guardGo: () => c.go("guard", t.guard.id),
      steps,
      details: [
        [i.S("f_trReason"), i.S(`trr_${t.reason}`)],
        [i.S("f_related"), t.related || "—"],
        [i.S("f_requestedBy"), t.requestedBy ? i.L(t.requestedBy) : "—"],
        [i.S("f_requesterKind"), i.S(t.requesterKind === "guard" ? "rk_guard" : "rk_supervisor")],
        [i.S("f_round"), String(t.round)],
        ...(t.scheduledDate
          ? [
              [i.S("f_date"), i.fd(t.scheduledDate, "full")],
              [i.S("provider"), i.S(`prov_${t.provider}`)],
            ]
          : []),
        ...(t.completedDate
          ? [
              [i.S("completedOn"), i.fd(t.completedDate, "full")],
              [i.S("result"), i.S(`res_${t.result}`)],
            ]
          : []),
      ].map(([k, v]) => ({ k, v })),
      notes: t.notes || "—",
      hist,
      isPM: canDecide,
      approve: () =>
        void c.actions
          .trainingStep(t.id, atSupervisor ? "review" : "approve")
          .then(() =>
            c.toast(i.S(atSupervisor ? "toastTrForwarded" : "toastTrApproved", { r: t.ref })),
          )
          .catch(fail(c)),
      ret: () => c.openModal("trReturn", { tid: t.id, ref: t.ref }),
      rej: () => c.openModal("trReject", { tid: t.id, ref: t.ref }),
      isGS,
      editNotes: String(ui.mf.notes ?? t.notes),
      onNotes: (e: { target: { value: string } }) =>
        set((s) => ({ mf: { ...s.mf, notes: e.target.value } })),
      resubmit: () =>
        void c.actions
          .trainingStep(t.id, "resubmit", { notes: String(ui.mf.notes ?? t.notes) })
          .then(() => c.toast(i.S("toastTrResubmitted", { r: t.ref })))
          .catch(fail(c)),
      canSched,
      sched: () =>
        c.openModal(
          "trSchedule",
          { tid: t.id, ref: t.ref },
          { date: me.today, provider: "internal" },
        ),
      canDone,
      done: () =>
        c.openModal(
          "trComplete",
          { tid: t.id, ref: t.ref },
          { date: me.today, res: "passed", note: "" },
        ),
      showWait:
        !canDecide &&
        !isGS &&
        !canSched &&
        !canDone &&
        t.status !== "completed" &&
        t.status !== "rejected",
      waitTxt:
        t.status === "pending_supervisor"
          ? i.S("waitSupervisor")
          : t.status === "pending_pm"
            ? i.S("waitPm")
            : t.status === "returned"
              ? i.S("waitRequester")
              : i.S("waitQuality"),
    },
  };
}

/** The guard's record (design: vmGuard) from issued reports and training. */
export function guardProfile(c: Ctx, g: Guard, h: GuardHistory | undefined) {
  const { i, me } = c;
  const evals = h?.evaluations ?? [];
  const avgPct = h?.average ?? null;
  const proj = (c.data.projects ?? []).find((p) => p.id === g.projectId);
  const last = evals.find((e) => e.pct != null);
  const bars = evals
    .slice(0, 8)
    .reverse()
    .map((e) => ({
      v: e.pct == null ? "—" : String(Math.round((e.pct / 20) * 10) / 10),
      h: `${e.pct ?? 0}%`,
      c: e.pct == null ? C.border.strong : scoreColor(e.pct),
    }));
  const training = h?.training ?? [];
  const flag = last?.pct != null && last.pct < 60 ? i.S("lowScoreFlag", { p: last.pct }) : "";
  return {
    gp: {
      back: () => c.go("guards"),
      emp: g.employeeNo,
      nid: g.nationalId,
      name: i.L(g.name),
      proj: proj ? i.L(proj.name) : "—",
      post: i.L(g.post),
      shift: i.S(`sh_${g.shift}`),
      avg: avgPct == null ? "—" : (avgPct / 20).toFixed(1),
      avgC: scoreColor(avgPct),
      canTrain: me.permissions.training.includes("A"),
      train: () => openRequest(c, g),
      hasFlag: !!flag,
      flag,
      n: String(evals.length),
      bars,
      evals: evals.map((e) => ({
        ref: e.visitRef,
        date: i.fd(e.date, "d"),
        note: e.note || "—",
        st: badge(
          i.S(
            e.pct == null
              ? "notEvaluated"
              : e.pct >= 80
                ? "g_good"
                : e.pct >= 60
                  ? "g_ok"
                  : "g_poor",
          ),
          e.pct == null ? "neu" : e.pct >= 80 ? "ok" : e.pct >= 60 ? "warn" : "bad",
        ),
        score: e.pct == null ? "—" : (e.pct / 20).toFixed(1),
        scoreC: scoreColor(e.pct),
        go: () => c.go("report", e.visitId),
      })),
      rec: training
        .filter((t) => t.status === "completed")
        .map((t) => ({
          course: t.course,
          ref: t.ref,
          date: t.completedDate ? i.fd(t.completedDate, "d") : "",
          res: i.S(`res_${t.result}`),
          resC: t.result === "failed" ? C.status.danger.fg : C.status.success.fg,
        })),
      trs: training
        .filter((t) => t.status !== "completed")
        .map((t) => ({
          course: t.course,
          ref: t.ref,
          date: i.fd(t.createdAt, "d"),
          st: stBadge(c, t.status),
          go: () => c.go("trainingD", t.id),
        })),
      hasObs: false,
      obs: [],
      hasCas: false,
      cas: [],
    },
  };
}

export const TRAINING_OPTIONS = { REASONS, PROVIDERS, RESULTS };
