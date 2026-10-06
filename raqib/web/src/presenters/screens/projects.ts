import type { Guard, Project } from "@/api/types";
import { pBadge, scoreColor, seg } from "../common";
import type { Ctx } from "../context";
import { actionRow, observationRow } from "./actions";
import { mean, nextVisitDate } from "./overview-figures";
import { projectFigures } from "./project-figures";
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
        (!q ||
          [
            p.code,
            p.name.ar,
            p.name.en,
            p.city.ar,
            p.city.en,
            p.manager?.name.ar ?? "",
            p.manager?.name.en ?? "",
          ].some((x) => x.toLowerCase().includes(q))),
    )
    .map((p) => {
      const f = projectFigures(c, p);
      return {
        name: i.L(p.name),
        code: p.code,
        st: pBadge(i, p.status),
        mgr: p.manager ? i.L(p.manager.name) : "—",
        city: i.L(p.city) + " · " + i.L(p.region),
        sites: String(p.sites.length),
        scoreTxt: f.score == null ? "—" : `${f.score}%`,
        scoreC: f.scoreColor,
        scoreW: `${f.score ?? 0}%`,
        obs: String(f.openObservations.length),
        ca: String(f.openActions.length),
        od: String(f.overdue.length),
        odC: f.overdue.length ? C.status.danger.fg : C.text.muted,
        last: f.last ? i.fd(f.last, "d") : "—",
        next: i.fd(nextVisitDate(f.visits, p.id, c.me.today) ?? p.firstVisitDate, "d"),
        go: () => c.go("project", p.id),
      };
    });
  return {
    pl: {
      rows,
      has: !!rows.length,
      none: !rows.length,
      count: i.S("nProjects", { n: all.length }),
      q: ui.pq,
      onQ: (e: { target: { value: string } }) => set({ pq: e.target.value }),
      clear: () => set({ pq: "", pstatus: "all" }),
      canCreate: c.me.permissions.projects.includes("A"),
      create: () => c.openModal("projNew", undefined, { pstatus: "mobilizing" }),
    },
    pstatusOpts: ["all", "active", "attention", "mobilizing", "closed"].map((k) =>
      seg(ui.pstatus, k, k === "all" ? i.S("all") : i.S(`ps_${k}`), () => set({ pstatus: k })),
    ),
  };
}

/** Project detail (design: vmProject). Sites and areas are real; results/observations fill in later phases. */
export function projectDetail(c: Ctx, p: Project) {
  const { i, ui, set } = c;
  const canEdit = c.me.permissions.projects.includes("E");
  const tabs = ["overview", "sites", "visits", "observations", "actions", "analytics"].map((k) => ({
    label: i.S(`pt_${k}`),
    go: () => set({ ptab: k }),
    fg: ui.ptab === k ? C.text.ink : C.text.secondary,
    bd: ui.ptab === k ? C.brand.primary : "transparent",
    fw: ui.ptab === k ? "600" : "500",
  }));
  const pt = ui.ptab;
  const f = projectFigures(c, p);
  const dataTab =
    pt === "sites" ||
    pt === "visits" ||
    (pt === "overview" && (f.hasResults || f.openActions.length > 0)) ||
    (pt === "observations" && f.observations.length > 0) ||
    (pt === "actions" && f.actions.length > 0) ||
    (pt === "analytics" && f.hasResults);
  const vs = (c.data.visits ?? []).filter((v) => v.project.id === p.id);
  const overdue = vs.filter((v) => v.status === "overdue");
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
      // Sites and visits are real data and always show; the figures tabs wait for the inspection results
      empty: !dataTab,
      notEmpty: dataTab,
      emptyTxt: p.firstVisitDate
        ? i.S("projEmpty", { d: i.fd(p.firstVisitDate, "full") })
        : i.S("projEmptyTitle"),
      scoreTxt: f.score == null ? "—" : `${f.score}%`,
      scoreC: f.scoreColor,
      delta:
        f.delta == null ? "" : i.S("vsPrev", { d: f.delta > 0 ? `+${f.delta}` : String(f.delta) }),
      deltaC:
        f.delta == null || f.delta === 0
          ? C.text.secondary
          : f.delta > 0
            ? C.status.success.fg
            : C.status.danger.fg,
      weeks: f.weeks.map((w) => ({ ...w, lbl: i.fd(w.from, "d") })),
      canEdit,
      edit: () =>
        c.openModal(
          "projEdit",
          { id: p.id, ref: i.L(p.name) },
          {
            nameAr: p.name.ar,
            nameEn: p.name.en,
            cityAr: p.city.ar,
            cityEn: p.city.en,
            regionAr: p.region.ar,
            regionEn: p.region.en,
            mgr: p.manager?.id ?? "",
            pstatus: p.status,
            first: p.firstVisitDate ?? "",
          },
        ),
      addSite: () => c.openModal("siteAdd", { id: p.id }),
      noSites: p.sites.length === 0,
      siteRows: p.sites.map((s) => ({
        id: s.id,
        rename: () =>
          c.openModal("siteRename", { id: s.id }, { nameAr: s.name.ar, nameEn: s.name.en }),
        archive: () => c.openModal("siteArchive", { id: s.id, ref: i.L(s.name) }),
        addArea: () => c.openModal("areaAdd", { id: s.id }),
        areaChips: s.areas.map((a) => ({
          n: i.L(a.name),
          archive: () => c.openModal("areaArchive", { id: a.id, ref: i.L(a.name) }),
        })),
        n: i.L(s.name),
        areas: s.areas.map((a) => i.L(a.name)).join(i.lang === "ar" ? "، " : ", ") || "—",
        ...siteFigures(c, f, s),
        vis: String(vs.filter((v) => v.site.id === s.id).length),
      })),
      recent: f.visits
        .filter((v) => v.status === "approved")
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5)
        .map((v) => visitRow(c, v)),
      visits: vs
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((v) => visitRow(c, v)),
      cas: f.actions.map((a) => actionRow(c, a)),
      openCas: f.openActions.slice(0, 6).map((a) => actionRow(c, a)),
      obs: f.observations.map((o) => observationRow(c, o)),
      attn: overdue.map((v) => ({
        t: i.S("attn_vOver", { r: v.ref }),
        sub: i.L(v.site.name),
        c: C.status.danger.fg,
        go: () => c.go("visit", v.id),
      })),
      hasAttn: overdue.length > 0,
      noAttn: overdue.length === 0,
      completion: i.S("completion", { a: f.done, b: f.planned }),
      compW: `${f.planned ? Math.round((f.done / f.planned) * 100) : 0}%`,
      canSchedule: c.me.permissions.visits.includes("A") && p.status !== "closed",
      schedule: () =>
        c.openModal("create", undefined, {
          p: p.id,
          date: c.me.today,
          time: "09:00",
          type: "routine",
          shift: "morning",
        }),
      openAnalytics: () => c.go("analytics", null, { anP: p.id }),
      back: () => c.go("projects"),
    },
    pt: {
      overview: pt === "overview",
      sites: pt === "sites",
      visits: pt === "visits",
      observations: pt === "observations",
      actions: pt === "actions",
      analytics: pt === "analytics",
    },
  };
}

/** A site's average score over its approved visits, and how many observations at it are still open. */
function siteFigures(c: Ctx, f: ReturnType<typeof projectFigures>, s: Project["sites"][number]) {
  const scores = f.visits
    .filter((v) => v.site.id === s.id && v.status === "approved" && v.scorePct != null)
    .map((v) => v.scorePct as number);
  const avg = mean(scores);
  const open = f.openObservations.filter((o) => o.site.en === s.name.en || o.site.ar === s.name.ar);
  return {
    scoreTxt: avg == null ? "—" : `${avg}%`,
    scoreW: `${avg ?? 0}%`,
    scoreC: scoreColor(
      avg,
      c.data.settings?.scoring.high ?? 85,
      c.data.settings?.scoring.mid ?? 75,
    ),
    obs: String(open.length),
  };
}

/** Guards in the caller's scope (design: vmGuards). */
export function guardsList(c: Ctx) {
  const { i, data } = c;
  const projects = new Map((data.projects ?? []).map((p) => [p.id, p]));
  const rows = (data.guards ?? []).map((g: Guard) => {
    const sm = data.guardSummary?.[g.id];
    return {
      inactive: g.status === "inactive",
      edit: () =>
        c.openModal(
          "guardEdit",
          { id: g.id, ref: i.L(g.name), account: g.userId ?? "" },
          {
            gproj: g.projectId,
            nameAr: g.name.ar,
            nameEn: g.name.en,
            postAr: g.post.ar,
            postEn: g.post.en,
            gshift: g.shift,
            gacct: g.userId ?? "",
            nid: "",
          },
        ),
      toggle: () =>
        c.openModal(g.status === "active" ? "guardOff" : "guardOn", { id: g.id, ref: i.L(g.name) }),
      toggleLabel: i.S(g.status === "active" ? "pa_deactivate" : "pa_activate"),
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
  const canManage = c.me.permissions.projects.includes("E");
  return {
    gd: {
      rows,
      count: i.S("nGuards", { n: rows.length }),
      training: [],
      canManage,
      add: () => c.openModal("guardNew", undefined, { gshift: "morning" }),
    },
  };
}
