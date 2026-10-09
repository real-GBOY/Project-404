/**
 * The typed API layer, the ONLY place components' data comes from. One file per backend resource in `resources/`, each a thin,
 * documented call per route (no business rules, no URL building elsewhere). Hooks and presenters depend on `api`; swapping
 * transport or adding a fake for tests happens here.
 */
import { authApi } from "./resources/auth";
import { meApi } from "./resources/me";
import { accountApi } from "./resources/account";
import { settingsApi } from "./resources/settings";
import { scoringApi } from "./resources/scoring";
import { permissionsApi } from "./resources/permissions";
import { usersApi } from "./resources/users";
import { projectsApi } from "./resources/projects";
import { visitsApi } from "./resources/visits";
import { notificationsApi } from "./resources/notifications";
import { formsApi } from "./resources/forms";
import { inspectionApi } from "./resources/inspection";
import { reviewApi } from "./resources/review";
import { evidenceApi } from "./resources/evidence";
import { observationsApi } from "./resources/observations";
import { actionsApi } from "./resources/actions";
import { trainingApi } from "./resources/training";
import { guardsApi } from "./resources/guards";
import { analyticsApi } from "./resources/analytics";
import { searchApi } from "./resources/search";
import { confidentialApi } from "./resources/confidential";
import { surveysApi } from "./resources/surveys";
import { auditApi } from "./resources/audit";
import { accountRequestsApi } from "./resources/account-requests";
import { reportsApi } from "./resources/reports";
import { publicApi } from "./resources/public";

export const api = {
  auth: authApi,
  public: publicApi,
  me: meApi,
  account: accountApi,
  settings: settingsApi,
  scoring: scoringApi,
  permissions: permissionsApi,
  users: usersApi,
  projects: projectsApi,
  visits: visitsApi,
  notifications: notificationsApi,
  forms: formsApi,
  inspection: inspectionApi,
  review: reviewApi,
  evidence: evidenceApi,
  observations: observationsApi,
  actions: actionsApi,
  training: trainingApi,
  guards: guardsApi,
  guardHistory: guardsApi.history,
  guardSummary: guardsApi.summary,
  analytics: analyticsApi,
  search: searchApi,
  conf: confidentialApi,
  surveys: surveysApi,
  audit: auditApi,
  accountRequests: accountRequestsApi,
  reports: reportsApi,
};
