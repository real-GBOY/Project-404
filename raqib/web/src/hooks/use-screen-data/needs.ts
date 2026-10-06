import type { Me } from "@/api/types";
import type { Route } from "@/presenters/context";

const VISIT_SCREENS = [
  "overview",
  "projects",
  "visits",
  "visit",
  "project",
  "inspect",
  "inspections",
  "reviews",
  "review",
  "report",
];
const GUARD_SCREENS = ["guards", "guard", "visit", "inspect", "review", "training", "trainingD"];

/**
 * Which server resources a screen needs. A resource is wanted only when the person's template can read it AND the screen
 * shows it, so no screen asks the backend for something it would refuse.
 */
export function screenNeeds(route: Route, me: Me) {
  const p = me.permissions;
  const n = route.n;
  // the quality / executive overview is computed from approved reports, observations and corrective actions
  const management = n === "overview" && ["qm", "qe", "gm"].includes(me.role);
  // the project list and page show scores, open issues and late actions
  const projectFigures = ["projects", "project"].includes(n);
  const guardRecords = p.guardEval.includes("V") || p.training.includes("V");
  const want = {
    // the shell labels a person's scope with project names whenever the template allows reading projects
    projects: p.projects.includes("V"),
    visits: p.visits.includes("V") && VISIT_SCREENS.includes(n),
    guards: (guardRecords && GUARD_SCREENS.includes(n)) || (n === "overview" && me.role === "gs"),
    // also the pickers in the project and guard dialogs (project managers, guard sign-in accounts)
    users:
      p.users.includes("V") &&
      ["users", "user", "permissions", "projects", "project", "guards"].includes(n),
    permissions: p.permissions.includes("V") && ["user", "permissions"].includes(n),
    settings: p.settings.includes("V") && (n === "settings" || management || projectFigures),
    forms: p.forms.includes("V") && ["forms", "form"].includes(n),
    inspection: ["inspect", "review"].includes(n) && !!route.id,
    observations:
      p.observations.includes("V") &&
      (["observations", "review"].includes(n) || management || projectFigures),
    actions: p.actions.includes("V") && (n === "actions" || management || projectFigures),
    action: p.actions.includes("V") && n === "action" && !!route.id,
    training: p.training.includes("V") && n === "training",
    trainingOne: p.training.includes("V") && n === "trainingD" && !!route.id,
    guardHistory: guardRecords && n === "guard" && !!route.id,
    guardSummary: guardRecords && ["guards", "overview"].includes(n),
    analytics: p.analytics.includes("V") && n === "analytics",
    audit: p.audit.includes("V") && n === "audit",
    accountRequests: p.users.includes("V") && ["users", "request"].includes(n),
    accountRequest: p.users.includes("V") && n === "request" && !!route.id,
    reports:
      p.reports.includes("V") &&
      (["reports", "report", "visit", "review"].includes(n) || management || projectFigures),
  };
  return want;
}

export type ScreenNeeds = ReturnType<typeof screenNeeds>;
