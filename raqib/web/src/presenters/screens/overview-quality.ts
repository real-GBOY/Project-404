import { C } from "@/styles/colors";
import { TONE, badge, scoreColor, seg } from "../common";
import type { Ctx } from "../context";
import {
  PERIOD_DAYS,
  compliance,
  isOpen,
  nextVisitDate,
  overdueActions,
  pipeline,
  recentEvents,
  weeklyAverages,
} from "./overview-figures";

const SEV_TONE: Record<string, string> = { high: "bad", medium: "warn", low: "info" };
const STAGE_TONE: Record<string, string> = {
  assigned: "info",
  in_progress: "info",
  under_review: "rev",
  returned: "warn",
  closed: "ok",
};

const first = (c: Ctx): string =>
  c.i.L(c.me.name).replace("م. ", "").replace("Eng. ", "").split(" ")[0] ?? "";
const heading = (c: Ctx) => ({
  greeting: c.i.S("greet", { n: first(c) }),
  todayLong: c.i.fd(c.me.today, "dy"),
});

/** Visit status groups for the "visit status" bar: key, statuses it counts, color. */
const VISIT_MIX: Array<[string, string[], string]> = [
  ["upcoming", ["scheduled", "assigned"], C.status.info.mark],
  ["in_progress", ["in_progress"], C.status.info.fg],
  ["pending", ["pending_review", "pending_approval"], C.status.review.fg],
  ["returned", ["returned"], C.status.warning.mark],
  ["approved", ["approved"], C.status.success.fg],
  ["rejected", ["rejected"], C.status.danger.fg],
  ["overdue", ["overdue"], C.status.danger.bright],
  ["cancelled", ["cancelled"], C.border.stronger],
];

/**
 * Quality / executive overview (design: vmOvMgmt). Every figure is computed from persisted data the person is allowed to read:
 * approved reports (compliance, trend), visits (status mix, what needs attention, recent events), observations and corrective
 * actions (open issues, pipeline, repeats). A role without access to one of those simply sees that part empty.
 */
export function overviewQuality(c: Ctx) {
  const { i, ui, set, data, me } = c;
  const today = me.today;
  const reports = data.reports?.items ?? [];
  const visits = data.visits ?? [];
  const observations = data.observations ?? [];
  const actions = data.actions ?? [];
  const high = data.settings?.scoring.high ?? 85;
  const mid = data.settings?.scoring.mid ?? 75;
  const projects = (data.projects ?? []).slice().sort((a, b) => a.code.localeCompare(b.code));
  const days = PERIOD_DAYS[ui.period];
  const comp = compliance(reports, today, days);
  const delta = comp.overall != null && comp.previous != null ? comp.overall - comp.previous : null;
  const signed = (d: number) => `${d > 0 ? "+" : ""}${d}`;
  const deltaColor = (d: number | null) =>
    d == null || d === 0 ? C.text.secondary : d > 0 ? C.status.success.fg : C.status.danger.fg;

  // ── what needs attention ──
  const pendingReview = visits.filter((v) => v.status === "pending_review");
  const oldest = pendingReview.length
    ? Math.max(...pendingReview.map((v) => i.days(v.date, today)))
    : 0;
  const pendingApproval = visits.filter((v) => v.status === "pending_approval").length;
  const returned = visits.filter((v) => v.status === "returned").length;
  const late = overdueActions(actions);
  const maxLate = late.length ? Math.max(...late.map((a) => i.days(a.dueDate, today))) : 0;
  const visitsOverdue = visits.filter((v) => v.status === "overdue");
  const repeats = observations.filter((o) => isOpen(o) && o.repeatCount >= 2);
  const manager = me.role === "qm";
  const attention = [
    {
      n: pendingReview.length,
      label: i.S("att_review"),
      sub: pendingReview.length ? i.S("att_review_sub", { n: oldest }) : i.S("att_none"),
      color: C.status.review.fg,
      go: () => c.go("reviews"),
    },
    {
      n: manager ? pendingApproval : returned,
      label: i.S(manager ? "att_approve" : "att_returned"),
      sub: i.S(manager ? "att_approve_sub" : "att_returned_sub"),
      color: C.status.review.fg,
      go: () => c.go("reviews"),
    },
    {
      n: late.length,
      label: i.S("att_caOver"),
      sub: i.S("att_caOver_sub", { n: maxLate }),
      color: C.status.danger.fg,
      go: () => c.go("actions"),
    },
    {
      n: visitsOverdue.length,
      label: i.S("att_vOver"),
      sub: i.S("att_vOver_sub"),
      color: C.status.danger.fg,
      go: () => c.go("visits", null, { vfilter: "overdue" }),
    },
    {
      n: repeats.length,
      label: i.S("att_repeat"),
      sub: i.S("att_repeat_sub"),
      color: C.status.warning.fg,
      go: () => c.go("observations"),
    },
  ];

  // ── trend bars ──
  const bars = weeklyAverages(reports, today).map((w) => ({
    h: w.avg == null ? "4px" : `${Math.max(6, Math.round(w.avg * 0.44))}px`,
    c: w.avg == null ? C.surface.sunken : scoreColor(w.avg, high, mid),
    dc: w.avg,
    tip: `${i.fd(w.from, "d")}: ${w.avg == null ? "—" : `${w.avg}%`}`,
  }));

  // ── per project ──
  const projectRows = projects.map((p) => {
    const s = comp.byProject.get(p.id);
    const score = s?.score ?? null;
    const d = score != null && s?.previous != null ? score - s.previous : null;
    const mine = observations.filter((o) => o.project.id === p.id);
    const openObs = mine.filter(isOpen).length;
    const lateHere = mine.filter((o) => o.action?.status === "overdue").length;
    const next = nextVisitDate(visits, p.id, today) ?? p.firstVisitDate;
    return {
      name: i.L(p.name),
      code: p.code,
      city: i.L(p.city),
      scoreW: `${score ?? 0}%`,
      scoreC: scoreColor(score, high, mid),
      scoreTxt: score == null ? "—" : `${score}%`,
      delta: d == null ? i.S("noData") : signed(d),
      deltaC: deltaColor(d),
      obs: String(openObs),
      overdue: String(lateHere),
      overdueC: lateHere ? C.status.danger.fg : C.text.muted,
      next: next ? i.fd(next, "d") : "—",
      go: () => c.go("project", p.id),
    };
  });

  // ── visit status mix ──
  const mix = VISIT_MIX.map(([k, sts, color]) => {
    const n = visits.filter((v) => sts.includes(v.status)).length;
    return {
      k,
      n,
      label: i.S(`vg_${k}`),
      c: color,
      w: `${visits.length ? (n / visits.length) * 100 : 0}%`,
      go: () =>
        c.go("visits", null, {
          vfilter: k === "pending" ? "pending_review" : k === "upcoming" ? "scheduled" : k,
        }),
    };
  }).filter((x) => x.n);

  // ── corrective-action pipeline, repeats, events ──
  const total = actions.length || 1;
  const caPipe = pipeline(actions).map((st) => ({
    label: i.S(`cs_${st.stage}`),
    n: st.n,
    w: `${(st.n / total) * 100}%`,
    c: TONE[STAGE_TONE[st.stage]!]![0],
    od: st.overdue ? i.S("nOverdue", { n: st.overdue }) : "",
    hasOd: st.overdue > 0,
    go: () => c.go("actions"),
  }));
  const repeated = repeats
    .slice()
    .sort((a, b) => b.repeatCount - a.repeatCount)
    .slice(0, 5)
    .map((o) => ({
      n: o.repeatCount,
      t: i.L(o.title),
      proj: `${i.L(o.project.name)} · ${i.L(o.site)}`,
      sev: badge(i.S(`sev_${o.severity}`), SEV_TONE[o.severity] ?? "neu"),
      go: () => c.go("observations"),
    }));
  const events = recentEvents(visits).map(({ visit, entry }) => ({
    who: i.L(entry.actor.name),
    act: i.t[`e_${entry.action}`] ?? entry.action,
    ref: visit.ref,
    at: i.fd(entry.at, "dt"),
    go: () => c.go("visit", visit.id),
  }));

  return {
    ov: {
      attention,
      overall: comp.overall ?? 0,
      overallTxt: comp.overall == null ? "—" : `${comp.overall}%`,
      deltaTxt: delta == null ? "" : i.S("vsPrev", { d: signed(delta) }),
      deltaC: deltaColor(delta),
      bars,
      projects: projectRows,
      vmix: mix,
      vTotal: i.S("nVisits", { n: visits.length }),
      caPipe,
      repeated,
      events,
      explain: i.S("explain", { n: comp.count }),
    },
    ...heading(c),
    explainOpen: ui.explain,
    toggleExplain: () => set({ explain: !ui.explain }),
    periodOpts: (["week", "month", "quarter"] as const).map((p) =>
      seg(ui.period, p, i.S(`per_${p}`), () => set({ period: p })),
    ),
    projCols: c.mobile
      ? "minmax(0,1fr) 110px"
      : "minmax(0,1.6fr) minmax(120px,1fr) 64px 72px 72px 80px",
    goApproved: () => c.go("reviews"),
  };
}
