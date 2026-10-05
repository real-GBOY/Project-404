import type { Guard, Project } from "@/api/types";
import { pBadge, scoreColor, seg } from "../common";
import type { Ctx } from "../context";
import { visitRow } from "./visits";
import { C } from "@/styles/colors";

/** Projects list (design: vmProjects). Compliance figures arrive with the inspection phases. */
export function projectsList(c: Ctx) {
  const { i, ui, set, data } = c;
  const all = data.projects ?? [];
  const q = ui.pq.trim().toLowerCase();
  const rows = all
    .filter(
      (p) =>
        (ui.pstatus === "all" || p.status === ui.pstatus) &&
        (!q || [p.code, p.name.ar, p.name.en, p.city.ar, p.city.en, p.manager?.name.ar ?? "", p.manager?.name.en ?? ""].some((x) => x.toLowerCase().includes(q))),
    )
    .map((p) => ({
      name: i.L(p.name),
      code: p.code,
      st: pBadge(i, p.status),
      mgr: p.manager ? i.L(p.manager.name) : "—",
      city: i.L(p.city) + " · " + i.L(p.region),
      sites: String(p.sites.length),
      scoreTxt: "—",
      scoreC: scoreColor(null),
      scoreW: "0%",
      obs: "0",
      ca: "0",
      od: "0",
      odC: C.text.muted,
      last: "—",
      next: i.fd(p.firstVisitDate, "d"),
      go: () => c.go("project", p.id),
    }));
  return {
    pl: {
      rows,
      has: !!rows.length,
      none: !rows.length,
      count: i.S("nProjects", { n: all.length }),
      q: ui.pq,
      onQ: (e: { target: { value: string } }) => set({ pq: e.target.value }),
      clear: () => set({ pq: "", pstatus: "all" }),
    },
    pstatusOpts: ["all", "active", "attention", "mobilizing"].map((k) =>
      seg(ui.pstatus, k, k === "all" ? i.S("all") : i.S(`ps_${k}`), () => set({ pstatus: k })),
    ),
  };
}

/** Project detail (design: vmProject). Sites and areas are real; results/observations fill in later phases. */
export function projectDetail(c: Ctx, p: Project) {
  const { i, ui, set } = c;
  const tabs = ["overview", "sites", "visits", "observations", "actions", "analytics"].map((k) => ({
    label: i.S(`pt_${k}`),
    go: () => set({ ptab: k }),
    fg: ui.ptab === k ? C.text.ink : C.text.secondary,
    bd: ui.ptab === k ? C.brand.primary : "transparent",
    fw: ui.ptab === k ? "600" : "500",
  }));
  const pt = ui.ptab;
  const vs = (c.data.visits ?? []).filter((v) => v.project.id === p.id);
  const overdue = vs.filter((v) => v.status === "overdue");
  const planned = vs.filter((v) => v.storedStatus !== "cancelled");
  return {
    pd: {
      name: i.L(p.name),
      code: p.code,
      st: pBadge(i, p.status),
      mgr: p.manager ? i.L(p.manager.name) : "—",
      city: i.L(p.city) + " · " + i.L(p.region),
      guards: i.S("nGuards", { n: p.guardCount }),
      sites: i.S("nSites", { n: p.sites.length }),
      tabs,
      empty: true,
      notEmpty: false,
      emptyTxt: p.firstVisitDate ? i.S("projEmpty", { d: i.fd(p.firstVisitDate, "full") }) : i.S("projEmptyTitle"),
      scoreTxt: "—",
      scoreC: scoreColor(null),
      delta: "",
      deltaC: C.text.secondary,
      weeks: [],
      siteRows: p.sites.map((s) => ({
        n: i.L(s.name),
        areas: s.areas.map((a) => i.L(a.name)).join(i.lang === "ar" ? "، " : ", ") || "—",
        scoreTxt: "—",
        scoreW: "0%",
        scoreC: scoreColor(null),
        vis: String(vs.filter((v) => v.site.id === s.id).length),
        obs: "0",
      })),
      recent: [],
      visits: vs.slice().sort((a, b) => b.date.localeCompare(a.date)).map((v) => visitRow(c, v)),
      cas: [],
      openCas: [],
      obs: [],
      attn: overdue.map((v) => ({ t: i.S("attn_vOver", { r: v.ref }), sub: i.L(v.site.name), c: C.status.danger.fg, go: () => c.go("visit", v.id) })),
      hasAttn: overdue.length > 0,
      noAttn: overdue.length === 0,
      completion: i.S("completion", { a: 0, b: planned.length }),
      compW: "0%",
      canSchedule: c.me.permissions.visits.includes("A"),
      schedule: () => c.openModal("create", undefined, { p: p.id, date: c.me.today, time: "09:00", type: "routine", shift: "morning" }),
      openAnalytics: () => undefined,
      back: () => c.go("projects"),
    },
    pt: { overview: pt === "overview", sites: pt === "sites", visits: pt === "visits", observations: pt === "observations", actions: pt === "actions", analytics: pt === "analytics" },
  };
}

/** Guards in the caller's scope (design: vmGuards). */
export function guardsList(c: Ctx) {
  const { i, data } = c;
  const projects = new Map((data.projects ?? []).map((p) => [p.id, p]));
  const rows = (data.guards ?? []).map((g: Guard) => {
    const sm = data.guardSummary?.[g.id];
    return {
    go: () => c.go("guard", g.id),
    name: i.L(g.name),
    emp: g.employeeNo,
    nid: g.nationalId,
    post: i.L(g.post),
    proj: projects.get(g.projectId) ? i.L(projects.get(g.projectId)!.name) : "—",
    avg: sm?.average == null ? "—" : (sm.average / 20).toFixed(1),
    avgC: scoreColor(sm?.average ?? null),
    avgW: `${sm?.average ?? 0}%`,
    evals: String(sm?.evaluations ?? 0),
    flag: "",
    hasFlag: false,
  };
  });
  return { gd: { rows, count: i.S("nGuards", { n: rows.length }), training: [] } };
}
