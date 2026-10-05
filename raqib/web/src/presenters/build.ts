import type { VM } from "@/ui/vm";
import type { Ctx } from "./context";
import { NAV_META, navKeyOf, visibleNav } from "./nav";
import { modalVM } from "./modals";
import { shellVM } from "./shell";
import { overviewGuard, overviewGuardsSupervisor, overviewInspector, overviewProjectManager, overviewQuality } from "./screens/overview";
import { guardsList, projectDetail, projectsList } from "./screens/projects";
import { permissionTemplates } from "./screens/permissions";
import { settingsScreen } from "./screens/settings";
import { userDetail, usersList } from "./screens/users";
import { visitDetail, visitsList } from "./screens/visits";
import { formBuilder, formsList } from "./screens/forms";
import { inspectionWorkspace } from "./screens/inspection";
import { reviewQueue } from "./screens/queue";
import { reviewDetail } from "./screens/review";
import { reportDetail, reportsIssued } from "./screens/reports";
import { guardProfile, trainingDetail, trainingList } from "./screens/training";
import { analytics } from "./screens/analytics";
import { searchVM } from "./search";
import { actionDetail, actionsList, observationsList } from "./screens/actions";

export type Denial = { k: "module" | "scope" | "forbidden"; res?: string };

/** Which `vm.is.*` flag drives which approved screen. */
const FLAG: Record<string, string> = {
  projects: "projects", project: "project", visits: "visits", visit: "visit", forms: "forms", form: "form", inspect: "inspect", inspections: "reviews", reviews: "reviews", review: "review", reports: "reports", report: "report", analytics: "analytics", training: "training", trainingD: "trainingD", guard: "guard", observations: "observations", actions: "actions", action: "action", guards: "guards", users: "users", user: "user", permissions: "perms", settings: "settings",
};

/** The denied screen (design: vmDenied). The backend produced the refusal; this only explains it. */
function denied(c: Ctx, d: Denial) {
  const { i, me } = c;
  const scopeText = me.scope === "all" ? i.S("allProjects") : String((me.scope as string[]).length);
  return {
    dn: {
      title: i.S("accessDenied"),
      body: d.k === "scope" ? i.S("dn_scope", { r: d.res ?? "" }) : i.S("dn_module", { m: d.res ?? "" }),
      rows: [
        [i.S("dn_you"), `${i.L(me.name)} · ${i.L(me.title)}`],
        [i.S("scope"), scopeText],
        [i.S("dn_res"), d.res || "—"],
        [i.S("dn_logged"), i.fd(new Date().toISOString(), "dt")],
      ].map(([k, v]) => ({ k, v })),
      home: () => c.go("overview"),
      request: () => undefined,
      canRequest: false,
    },
  };
}

/**
 * The single entry point: server data + UI state + language → the view-model the approved screens render.
 * `pending` is true while the screen's queries load (the design's skeleton shows); `denial` is set when the
 * backend refused the resource.
 */
export function buildVM(c: Ctx, opts: { pending: boolean; denial: Denial | null }): VM {
  const { i, me, route } = c;
  const n = route.n;
  const nav = visibleNav(me);

  let scr = n;
  let title = "";
  const navKey = navKeyOf(n);
  let denial = opts.denial;
  if (!denial && navKey !== "overview" && !nav.includes(navKey) && !["setup"].includes(n)) {
    denial = { k: "module", res: i.t[`nav_${navKey}_${me.role}`] ?? navKey };
  }

  const is: Record<string, boolean> = {};
  if (n === "inspect") {
    const v = (c.data.visits ?? []).find((x) => x.id === route.id);
    if (v && ["pending_review", "pending_approval", "approved", "rejected", "cancelled"].includes(v.storedStatus)) c.go("review", route.id);
  }
  let body: VM = {};
  if (denial) {
    scr = "denied";
    is.denied = true;
    body = denied(c, denial);
  } else if (n === "overview") {
    const flag = { qm: "ovMgmt", qe: "ovMgmt", gm: "ovMgmt", pm: "ovPm", ins: "ovIns", gs: "ovGs", guard: "ovGuard" }[me.role];
    is[flag] = true;
    if (flag === "ovMgmt") body = overviewQuality(c);
    else if (flag === "ovPm") body = overviewProjectManager(c);
    else if (flag === "ovIns") body = overviewInspector(c);
    else if (flag === "ovGs") { body = overviewGuardsSupervisor(c); is.showGuardTable = true; }
    else body = overviewGuard(c);
  } else if (FLAG[n]) {
    is[FLAG[n]!] = true;
    if (n === "projects") body = projectsList(c);
    else if (n === "project") {
      const p = (c.data.projects ?? []).find((x) => x.id === route.id);
      if (p) { body = projectDetail(c, p); title = i.L(p.name); }
    } else if (n === "visits") body = visitsList(c);
    else if (n === "visit") {
      const v = (c.data.visits ?? []).find((x) => x.id === route.id);
      if (v) { body = visitDetail(c, v); title = v.ref; }
    } else if (n === "forms") body = formsList(c);
    else if (n === "form") {
      const fm = c.data.forms?.items.find((x) => x.id === route.id);
      if (fm) { body = formBuilder(c, fm); title = i.L(fm.name); }
    } else if (n === "inspect") {
      const v = (c.data.visits ?? []).find((x) => x.id === route.id);
      if (c.data.inspection) { body = inspectionWorkspace(c, c.data.inspection, v); title = i.S("inspection"); }
    } else if (n === "inspections") body = reviewQueue(c, true);
    else if (n === "reviews") body = reviewQueue(c, false);
    else if (n === "review") {
      const v = (c.data.visits ?? []).find((x) => x.id === route.id);
      if (c.data.inspection && v) { body = reviewDetail(c, c.data.inspection, v); title = v.ref; }
    }
    else if (n === "analytics") body = analytics(c, c.data.analytics);
    else if (n === "training") body = trainingList(c);
    else if (n === "trainingD") {
      if (c.data.trainingOne) { body = trainingDetail(c, c.data.trainingOne); title = c.data.trainingOne.ref; }
    } else if (n === "guard") {
      const g = (c.data.guards ?? []).find((x) => x.id === route.id);
      if (g) { body = guardProfile(c, g, c.data.guardHistory); title = i.L(g.name); }
    }
    else if (n === "observations") body = observationsList(c);
    else if (n === "actions") body = actionsList(c);
    else if (n === "action") {
      if (c.data.action) { body = actionDetail(c, c.data.action); title = c.data.action.ref; }
    }
    else if (n === "reports") body = reportsIssued(c);
    else if (n === "report") {
      const r = c.data.reports?.items.find((x) => x.visitId === route.id);
      if (r) { body = reportDetail(c, r); title = r.ref; }
    }
    else if (n === "guards") { body = guardsList(c); is.showGuardTable = true; }
    else if (n === "users") body = usersList(c);
    else if (n === "user") {
      const u = (c.data.users ?? []).find((x) => x.id === route.id);
      if (u) { body = userDetail(c, u); title = i.L(u.name); }
    } else if (n === "permissions") body = permissionTemplates(c);
    else if (n === "settings") body = settingsScreen(c);
  } else {
    is.stub = true;
    body = { stub: { title: i.t[`nav_${navKey}_${me.role}`] ?? navKey, body: i.S("stubPhase"), phase: "" } };
  }

  const pageTitle =
    title ||
    ({ denied: i.S("accessDenied") } as Record<string, string>)[scr] ||
    i.t[`nav_${navKey}_${me.role}`] ||
    i.L(NAV_META[navKey]?.l) ||
    "";
  return {
    ...shellVM(c, scr, pageTitle),
    ...searchVM(c),
    ...body,
    ...modalVM(c),
    is,
    loading: opts.pending,
    notLoading: !opts.pending,
    ready: true,
    pageTitle,
  };
}

export { guardsList };
