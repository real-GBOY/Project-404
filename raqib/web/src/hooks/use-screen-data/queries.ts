import { api } from "@/api";
import type { AnalyticsQueryParams, AuditQueryParams, ConfAccess, Me } from "@/api/types";
import { applyOps } from "@/services/offline/apply";
import { offline } from "@/services/offline/session";
import type { Route } from "@/presenters/context";
import { analyticsRangeReady } from "@/presenters/screens/analytics";
import type { UiState } from "@/state/ui-store";
import { QK } from "../query-keys";
import type { ScreenNeeds } from "./needs";

export interface QueryContext {
  route: Route;
  me: Me;
  ui: UiState;
  want: ScreenNeeds;
  analytics: AnalyticsQueryParams;
  audit: AuditQueryParams;
  conf: { conf: boolean; access: ConfAccess | undefined; officer: boolean; gm: boolean };
  /** the project and date a schedule dialog is looking for inspectors on ("" when no such dialog is open) */
  inspectors: { project: string; date: string };
}

/**
 * Queries that never block a screen from showing: they load behind it. (Everything else keeps the skeleton up until it arrives.)
 */
export const NON_BLOCKING: ReadonlySet<string> = new Set([
  QK.inspectors,
  QK.notifications,
  QK.responsibles,
  QK.formOptions,
  QK.visitForms,
  QK.searchHits,
  QK.confGrantees,
]);

/**
 * One definition per server resource a screen can show: its key, whether it is wanted right now, how to fetch it and what
 * else the cache key depends on. Reads the inspector needs while out of signal go through the offline cache.
 */
export function queryDefs({
  route,
  me,
  ui,
  want,
  analytics,
  audit,
  conf,
  inspectors,
}: QueryContext) {
  const id = route.id ?? "";
  return [
    {
      key: QK.projects,
      enabled: want.projects,
      fn: () => offline.withCache("projects", () => api.projects.list()),
    },
    {
      key: QK.guards,
      enabled: want.guards,
      fn: () => offline.withCache("guards", () => api.guards.list()),
    },
    { key: QK.users, enabled: want.users, fn: () => api.users.list() },
    { key: QK.permissions, enabled: want.permissions, fn: () => api.permissions.overview() },
    { key: QK.settings, enabled: want.settings, fn: () => api.settings.get() },
    {
      key: QK.visits,
      enabled: want.visits,
      fn: () => offline.withCache("visits", () => api.visits.list()),
    },
    {
      key: QK.shifts,
      enabled: want.shifts,
      fn: () => offline.withCache("shifts", () => api.visits.shifts()),
    },
    { key: QK.scoring, enabled: want.scoring, fn: () => api.scoring.overview() },
    {
      key: QK.forms,
      enabled: want.forms,
      fn: () =>
        api.forms.list().then((items) => ({
          items,
          capabilities: {
            add: me.permissions.forms.includes("A"),
            edit: me.permissions.forms.includes("E"),
            publish: me.permissions.forms.includes("P"),
          },
        })),
    },
    {
      key: QK.inspection,
      enabled: want.inspection,
      // the last copy seen is kept on the device, and changes still waiting to be sent are shown on top of whatever the server says
      fn: async () => {
        const form = ui.formId;
        const view = await offline.withCache(`inspection:${id}${form ? `:${form}` : ""}`, () =>
          api.inspection.get(id, form || undefined),
        );
        const waiting = (await offline.list()).filter((o) => o.visitId === id && !o.failed);
        return waiting.length ? applyOps(view, waiting) : view;
      },
      extra: [id, ui.formId],
    },
    {
      key: QK.visitForms,
      enabled: want.inspection,
      fn: () => api.inspection.forms(id),
      extra: [id],
    },
    {
      key: QK.formOptions,
      enabled: !!ui.modal && ui.modal.kind === "create",
      fn: () => api.visits.formOptions(),
    },
    { key: QK.observations, enabled: want.observations, fn: () => api.observations.list() },
    { key: QK.actions, enabled: want.actions, fn: () => api.actions.list() },
    { key: QK.action, enabled: want.action, fn: () => api.actions.get(id), extra: [id] },
    {
      key: QK.responsibles,
      // the people who can take an action on that project: needed to create one, and to hand one to someone else
      enabled: !!ui.modal && (ui.modal.kind === "ca" || ui.modal.kind === "caReassign"),
      fn: () => api.actions.responsible(String(ui.modal?.pid ?? "")),
      extra: [String(ui.modal?.pid ?? "")],
    },
    { key: QK.training, enabled: want.training, fn: () => api.training.list() },
    { key: QK.trainingOne, enabled: want.trainingOne, fn: () => api.training.get(id), extra: [id] },
    {
      key: QK.guardHistory,
      enabled: want.guardHistory,
      fn: () => api.guardHistory(id),
      extra: [id],
    },
    { key: QK.guardSummary, enabled: want.guardSummary, fn: () => api.guardSummary() },
    {
      key: QK.analytics,
      enabled: want.analytics && analyticsRangeReady(analytics), // a half-typed custom range is not asked of the server
      fn: () => api.analytics.get(analytics),
      extra: [
        analytics.period,
        analytics.from,
        analytics.to,
        analytics.projectId,
        analytics.siteId,
      ],
    },
    {
      key: QK.searchHits,
      enabled: ui.search && ui.q.trim().length >= 2,
      fn: () => api.search(ui.q.trim()),
      extra: [ui.q.trim()],
    },
    {
      key: QK.confMine,
      enabled: conf.conf && !!conf.access && !conf.access.grant && !conf.access.isGM,
      fn: () => api.conf.mine(),
    },
    { key: QK.confList, enabled: conf.officer, fn: () => api.conf.list() },
    {
      key: QK.confDetail,
      enabled: conf.officer && !!ui.cfSel,
      fn: () => api.conf.get(ui.cfSel),
      extra: [ui.cfSel],
    },
    { key: QK.confGrants, enabled: conf.gm, fn: () => api.conf.grants() },
    {
      key: QK.confGrantees,
      enabled: conf.gm && !!ui.modal && ui.modal.kind === "grantAdd",
      fn: () => api.conf.grantees(),
    },
    { key: QK.confLog, enabled: conf.gm, fn: () => api.conf.log() },
    {
      key: QK.audit,
      enabled: want.audit,
      fn: () => api.audit.list(audit),
      extra: [audit.q, audit.entity, audit.actor, audit.from, audit.to],
    },
    {
      key: QK.accountRequests,
      enabled: want.accountRequests,
      fn: () => api.accountRequests.list(),
    },
    {
      key: QK.accountRequest,
      enabled: want.accountRequest,
      fn: () => api.accountRequests.get(id),
      extra: [id],
    },
    { key: QK.reports, enabled: want.reports, fn: () => api.reports.list() },
    {
      key: QK.notifications,
      enabled: true,
      fn: () =>
        api.notifications.list().then((r) => ({ items: r.notifications, unread: r.unreadCount })),
      refetch: 30_000,
    },
    {
      key: QK.inspectors,
      enabled: !!inspectors.project,
      fn: () => api.visits.eligibleInspectors(inspectors.project, inspectors.date),
      extra: [inspectors.project, inspectors.date],
    },
  ] as const;
}

export type QueryDef = ReturnType<typeof queryDefs>[number];
