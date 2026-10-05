/**
 * Every TanStack Query key the app uses, in one place. Screen queries (`use-screen-data`), commands that invalidate them
 * (`use-actions`) and the offline sync all name a resource through these, so a rename is one edit and a typo cannot
 * silently leave a screen stale.
 */
export const QK = {
  projects: "projects",
  guards: "guards",
  users: "users",
  permissions: "permissions",
  settings: "settings",
  visits: "visits",
  forms: "forms",
  inspection: "inspection",
  observations: "observations",
  actions: "actions",
  action: "action",
  responsibles: "responsibles",
  training: "training",
  trainingOne: "trainingOne",
  guardHistory: "guardHistory",
  guardSummary: "guardSummary",
  analytics: "analytics",
  searchHits: "searchHits",
  confAccess: "confAccess",
  confMine: "confMine",
  confList: "confList",
  confDetail: "confDetail",
  confGrants: "confGrants",
  confGrantees: "confGrantees",
  confLog: "confLog",
  audit: "audit",
  accountRequests: "accountRequests",
  accountRequest: "accountRequest",
  reports: "reports",
  notifications: "notifications",
  inspectors: "inspectors",
} as const;

export type QueryKeyName = (typeof QK)[keyof typeof QK];
