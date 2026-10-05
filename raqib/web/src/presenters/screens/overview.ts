import { TONE, badge, scoreColor, seg } from "../common";
import type { Ctx } from "../context";
import { guardsList } from "./projects";
import { VST, startInspection, visitRow } from "./visits";
import { C } from "@/styles/colors";

const first = (c: Ctx): string => c.i.L(c.me.name).replace("م. ", "").replace("Eng. ", "").split(" ")[0] ?? "";
const heading = (c: Ctx) => ({ greeting: c.i.S("greet", { n: first(c) }), todayLong: c.i.fd(c.me.today, "dy") });

const VMIX: Array<[string, string[], string]> = [
  ["upcoming", ["scheduled", "assigned"], C.status.info.mark], ["in_progress", ["in_progress"], C.status.info.fg], ["pending", ["pending_review", "pending_approval"], C.status.review.fg],
  ["returned", ["returned"], C.status.warning.mark], ["approved", ["approved"], C.status.success.fg], ["rejected", ["rejected"], C.status.danger.fg],
  ["overdue", ["overdue"], C.status.danger.bright], ["cancelled", ["cancelled"], C.border.stronger],
];

/** Quality / executive overview (design: vmOvMgmt). Figures come from persisted data only; until the inspection phases land every count is a true zero. */
export function overviewQuality(c: Ctx) {
  const { i, ui, set, data } = c;
  const projects = (data.projects ?? []).slice().sort((a, b) => a.code.localeCompare(b.code));
  const visits = data.visits ?? [];
  const vOver = visits.filter((v) => v.status === "overdue");
  const att = [
    { n: 0, label: i.S("att_review"), sub: i.S("att_none"), color: C.status.review.fg, go: () => c.go("reviews") },
    { n: 0, label: i.S(c.me.role === "qm" ? "att_approve" : "att_returned"), sub: i.S(c.me.role === "qm" ? "att_approve_sub" : "att_returned_sub"), color: C.status.review.fg, go: () => c.go("reviews") },
    { n: 0, label: i.S("att_caOver"), sub: i.S("att_caOver_sub", { n: 0 }), color: C.status.danger.fg, go: () => c.go("actions") },
    { n: vOver.length, label: i.S("att_vOver"), sub: i.S("att_vOver_sub"), color: C.status.danger.fg, go: () => c.go("visits", null, { vfilter: "overdue" }) },
    { n: 0, label: i.S("att_repeat"), sub: i.S("att_repeat_sub"), color: C.status.warning.fg, go: () => c.go("observations") },
  ];
  const stages = ["assigned", "in_progress", "under_review", "returned", "closed"];
  const tone: Record<string, string> = { assigned: "info", in_progress: "info", under_review: "rev", returned: "warn", closed: "ok" };
  return {
    ov: {
      attention: att,
      overall: 0,
      overallTxt: "—",
      deltaTxt: "",
      deltaC: C.text.secondary,
      bars: [],
      projects: projects.map((p) => ({
        name: i.L(p.name), code: p.code, city: i.L(p.city), scoreW: "0%", scoreC: scoreColor(null), scoreTxt: "—",
        delta: i.S("noData"), deltaC: C.text.secondary, obs: "0", overdue: "0", overdueC: C.text.muted, next: i.fd(p.firstVisitDate, "d"), go: () => c.go("project", p.id),
      })),
      vmix: VMIX.map(([k, sts, color]) => {
        const n = visits.filter((v) => sts.includes(v.status)).length;
        return { k, n, label: i.S(`vg_${k}`), c: color, w: `${visits.length ? (n / visits.length) * 100 : 0}%`, go: () => c.go("visits", null, { vfilter: ["approved", "rejected", "cancelled"].includes(k) ? "closed" : k }) };
      }).filter((x) => x.n),
      vTotal: i.S("nVisits", { n: visits.length }),
      caPipe: stages.map((st) => ({ label: i.S(`cs_${st}`), n: 0, w: "0%", c: TONE[tone[st]!]![0], od: "", hasOd: false, go: () => c.go("actions") })),
      repeated: [],
      events: [],
      explain: i.S("explain", { n: 0 }),
    },
    ...heading(c),
    explainOpen: ui.explain,
    toggleExplain: () => set({ explain: !ui.explain }),
    periodOpts: ["week", "month", "quarter"].map((p) => seg(ui.period, p, i.S(`per_${p}`), () => set({ period: p as "week" | "month" | "quarter" }))),
    projCols: c.mobile ? "minmax(0,1fr) 110px" : "minmax(0,1.6fr) minmax(120px,1fr) 64px 72px 72px 80px",
    goApproved: () => c.go("reviews"),
  };
}

/** Project manager overview (design: vmOvPm). */
export function overviewProjectManager(c: Ctx) {
  const { i, data } = c;
  const projects = data.projects ?? [];
  const nextVisit = (data.visits ?? [])
    .filter((v) => v.date >= c.me.today && ["scheduled", "assigned"].includes(v.status))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  return {
    ...heading(c),
    pm: {
      attention: [
        { n: 0, label: i.S("pm_myCA"), sub: i.S("pm_myCA_sub"), color: C.status.info.fg, go: () => c.go("actions") },
        { n: 0, label: i.S("att_caOver"), sub: i.S("pm_od_sub"), color: C.status.danger.fg, go: () => c.go("actions") },
        { n: 0, label: i.S("att_repeat"), sub: i.S("att_repeat_sub"), color: C.status.warning.fg, go: () => c.go("observations") },
        { n: 0, label: i.S("pm_obs"), sub: i.S("pm_obs_sub"), color: C.text.ink, go: () => c.go("observations") },
      ],
      projects: projects.map((p) => ({
        name: i.L(p.name), code: p.code, city: i.L(p.city), scoreTxt: "—", scoreC: scoreColor(null), scoreW: "0%",
        sub: p.firstVisitDate ? i.S("pm_mobilizing", { d: i.fd(p.firstVisitDate, "d") }) : i.S("pm_projSub", { o: 0, c: 0, d: 0 }),
        go: () => c.go("project", p.id),
      })),
      cas: [],
      hasCas: false,
      next: nextVisit ? i.S("pm_next", { r: nextVisit.ref, d: i.fd(nextVisit.date, "d"), t: nextVisit.time, s: i.L(nextVisit.site.name) }) : i.S("pm_noNext"),
    },
  };
}

/** Inspector overview (design: vmOvIns). The visits the backend returns are already only this inspector's. */
export function overviewInspector(c: Ctx) {
  const { i, data, me } = c;
  const mine = data.visits ?? [];
  const card = (v: (typeof mine)[number]) => ({
    ...visitRow(c, v),
    primaryLabel: v.status === "in_progress" ? i.S("continueInsp") : v.status === "returned" ? i.S("openToFix") : ["assigned", "scheduled", "overdue"].includes(v.status) ? i.S("startInsp") : i.S("view"),
    primary: () => (["assigned", "scheduled", "overdue", "in_progress", "returned"].includes(v.status) ? startInspection(c, v) : c.go("visit", v.id)),
    progress: "",
    hasProgress: false,
  });
  const today = mine.filter((v) => v.date === me.today && v.storedStatus !== "cancelled").sort((a, b) => a.time.localeCompare(b.time)).map(card);
  const up = mine.filter((v) => v.date > me.today && ["assigned", "scheduled"].includes(v.storedStatus)).sort((a, b) => a.date.localeCompare(b.date)).map(card);
  void VST;
  return {
    ins: { today, hasToday: !!today.length, noToday: !today.length, ret: [], hasRet: false, up, hasUp: !!up.length, rec: [], hasRec: false },
    todayLong: i.fd(me.today, "dy"),
    insHead: today.length ? i.S("insHead", { n: today.length }) : i.S("insHeadNone"),
  };
}

/** Guards supervisor overview: the guard table plus their training queue (design: vmGuards). */
export function overviewGuardsSupervisor(c: Ctx) {
  return { ...guardsList(c), ...heading(c) };
}

/** Security guard home (design: vmOvGuard). */
export function overviewGuard(c: Ctx) {
  const { i } = c;
  const preset = () => () => c.go("confidential");
  return {
    greeting: i.S("greet", { n: first(c) }),
    gu: {
      sub: i.S("guardSub", { e: c.me.employeeNo ?? "", p: "" }).replace(/ · $/, ""),
      actions: [
        { label: i.S("ck_confidential"), sub: i.S("ck_confidential_sub"), go: preset() },
        { label: i.S("ck_complaint"), sub: i.S("ck_complaint_sub"), go: preset() },
        { label: i.S("ck_survey"), sub: i.S("ck_survey_sub"), go: preset() },
      ],
      responses: [],
      hasResp: false,
      mine: [],
    },
  };
}

export { badge };
