import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import { api } from "@/api/raqib";
import type { Me } from "@/api/types";
import type { UiState } from "@/state/ui-store";
import { ApiError } from "@/config";
import type { Data, Route } from "@/presenters/context";
import type { Denial } from "@/presenters/build";

/**
 * Which server resources a screen needs. Each is its own TanStack Query (server state stays out of any global
 * store); a query is only enabled when the person's template can read it AND the screen needs it, so no screen
 * asks the backend for something it would refuse.
 */
function needs(route: Route, me: Me) {
  const visitScreens = ["overview", "visits", "visit", "project", "inspect", "inspections", "reviews", "review", "report"];
  const p = me.permissions;
  const n = route.n;
  const want = {
    projects: p.projects.includes("V") && ["overview", "projects", "project", "users", "user", "permissions", "settings"].includes(n),
    visits: p.visits.includes("V") && visitScreens.includes(n),
    guards: (p.guardEval.includes("V") || p.training.includes("V")) && ["guards", "guard", "visit", "inspect", "review", "training", "trainingD"].includes(n) || (n === "overview" && me.role === "gs"),
    users: p.users.includes("V") && ["users", "user", "permissions"].includes(n),
    permissions: p.permissions.includes("V") && ["user", "permissions"].includes(n),
    settings: p.settings.includes("V") && n === "settings",
    forms: p.forms.includes("V") && ["forms", "form"].includes(n),
    inspection: ["inspect", "review"].includes(n) && !!route.id,
    observations: p.observations.includes("V") && ["observations", "review"].includes(n),
    actions: p.actions.includes("V") && ["actions"].includes(n),
    action: p.actions.includes("V") && n === "action" && !!route.id,
    training: p.training.includes("V") && ["training"].includes(n),
    trainingOne: p.training.includes("V") && n === "trainingD" && !!route.id,
    guardHistory: (p.guardEval.includes("V") || p.training.includes("V")) && n === "guard" && !!route.id,
    guardSummary: (p.guardEval.includes("V") || p.training.includes("V")) && ["guards", "overview"].includes(n),
    reports: p.reports.includes("V") && ["reports", "report", "visit", "review"].includes(n),
  };
  // the shell labels a person's scope with project names whenever the template allows reading projects
  if (p.projects.includes("V")) want.projects = true;
  return want;
}

export function useScreenData(route: Route, me: Me, ui: UiState): { data: Data; pending: boolean; denial: Denial | null; error: Error | null; retry: () => void } {
  const want = needs(route, me);
  const modalOpen = ui.modal && ["create", "resched"].includes(ui.modal.kind);
  const inspProject = modalOpen ? String(ui.mf.p ?? "") : "";
  const inspDate = String(ui.mf.date ?? me.today) || me.today;
  const defs = [
    { key: "projects", enabled: want.projects, fn: () => api.projects.list() },
    { key: "guards", enabled: want.guards, fn: () => api.guards.list() },
    { key: "users", enabled: want.users, fn: () => api.users.list() },
    { key: "permissions", enabled: want.permissions, fn: () => api.permissions.overview() },
    { key: "settings", enabled: want.settings, fn: () => api.settings.get() },
    { key: "visits", enabled: want.visits, fn: () => api.visits.list() },
    { key: "forms", enabled: want.forms, fn: () => api.forms.list().then(async (items) => ({ items, capabilities: { add: me.permissions.forms.includes("A"), edit: me.permissions.forms.includes("E"), publish: me.permissions.forms.includes("P") } })) },
    { key: "inspection", enabled: want.inspection, fn: () => api.inspection.get(route.id!), extra: [route.id ?? ""] },
    { key: "observations", enabled: want.observations, fn: () => api.observations.list() },
    { key: "actions", enabled: want.actions, fn: () => api.actions.list() },
    { key: "action", enabled: want.action, fn: () => api.actions.get(route.id!), extra: [route.id ?? ""] },
    { key: "responsibles", enabled: !!ui.modal && ui.modal.kind === "ca", fn: () => api.actions.responsible(String(ui.modal?.pid ?? "")), extra: [String(ui.modal?.pid ?? "")] },
    { key: "training", enabled: want.training, fn: () => api.training.list() },
    { key: "trainingOne", enabled: want.trainingOne, fn: () => api.training.get(route.id!), extra: [route.id ?? ""] },
    { key: "guardHistory", enabled: want.guardHistory, fn: () => api.guardHistory(route.id!), extra: [route.id ?? ""] },
    { key: "guardSummary", enabled: want.guardSummary, fn: () => api.guardSummary() },
    { key: "reports", enabled: want.reports, fn: () => api.reports.list() },
    { key: "notifications", enabled: true, fn: () => api.notifications.list().then((r) => ({ items: r.notifications, unread: r.unreadCount })), refetch: 30_000 },
    { key: "inspectors", enabled: !!inspProject, fn: () => api.visits.eligibleInspectors(inspProject, inspDate), extra: [inspProject, inspDate] },
  ] as const;
  const results = useQueries({
    queries: defs.map((d) => ({ queryKey: [d.key, ...(("extra" in d && d.extra) || [])], queryFn: d.fn, enabled: d.enabled, staleTime: 15_000, refetchInterval: ("refetch" in d && d.refetch) || false })),
  }) as UseQueryResult<unknown>[];

  const data: Data = {};
  defs.forEach((d, idx) => {
    const r = results[idx]!;
    if (r.data !== undefined) (data as Record<string, unknown>)[d.key] = r.data;
  });
  const pending = defs.some((d, idx) => d.enabled && d.key !== "inspectors" && d.key !== "notifications" && d.key !== "responsibles" && results[idx]!.isPending);
  const failed = results.find((r) => r.error);
  const err = (failed?.error as Error | undefined) ?? null;

  let denial: Denial | null = null;
  if (err instanceof ApiError && err.isForbidden) denial = { k: err.code === "raqib.out_of_scope" ? "scope" : "module", res: route.id ?? route.n };
  // A detail route whose record is not in the (scope-filtered) list is outside the caller's scope or gone.
  if (!denial && !pending && !err) {
    if (route.n === "project" && data.projects && !data.projects.some((x) => x.id === route.id)) denial = { k: "scope", res: route.id ?? "" };
    if ((route.n === "visit" || route.n === "review" || route.n === "inspect") && data.visits && !data.visits.some((x) => x.id === route.id)) denial = { k: "scope", res: route.id ?? "" };
    if (route.n === "visit" && data.visits && !data.visits.some((x) => x.id === route.id)) denial = { k: "scope", res: route.id ?? "" };
    if (route.n === "report" && data.visits && !data.visits.some((x) => x.id === route.id)) denial = { k: "scope", res: route.id ?? "" };
    if (route.n === "user" && data.users && !data.users.some((x) => x.id === route.id)) denial = { k: "scope", res: route.id ?? "" };
  }
  return { data, pending, denial, error: denial ? null : err, retry: () => results.forEach((r) => void r.refetch()) };
}
