import type { AnalyticsResult, AppNotification, SearchHit, CorrectiveAction, GuardHistory, GuardSummaries, TrainingRequest, EligibleInspector, Form, Guard, Inspection, Me, OrgSettings, PermissionsOverview, Observation, Person, Project, Report, ResponsibleOption, Visit } from "@/api/types";
import type { I18n } from "@/i18n/i18n";
import type { UiState } from "@/state/ui-store";
import type { Actions } from "./actions";

/** Server data the current screen has loaded (TanStack Query results, `undefined` until loaded). */
export interface Data {
  projects?: Project[];
  guards?: Guard[];
  users?: Person[];
  permissions?: PermissionsOverview;
  settings?: OrgSettings;
  visits?: Visit[];
  forms?: { items: Form[]; capabilities: { add: boolean; edit: boolean; publish: boolean } };
  inspection?: Inspection;
  reports?: { items: Report[]; pdf: boolean };
  observations?: Observation[];
  actions?: CorrectiveAction[];
  training?: TrainingRequest[];
  analytics?: AnalyticsResult;
  searchHits?: SearchHit[];
  trainingOne?: TrainingRequest;
  guardHistory?: GuardHistory;
  guardSummary?: GuardSummaries;
  action?: CorrectiveAction;
  /** People who may be given an action on the project chosen in the open dialog. */
  responsibles?: ResponsibleOption[];
  notifications?: { items: AppNotification[]; unread: number };
  /** Inspectors a visit can be assigned to for the project chosen in the open dialog. */
  inspectors?: EligibleInspector[];
}

export type Route = { n: string; id: string | null };

/**
 * Everything a presenter may read or call. Presenters turn (server data + UI state + language) into the
 * flat view-model the approved screens render; they never fetch and never decide authorization.
 */
export interface Ctx {
  i: I18n;
  me: Me;
  ui: UiState;
  set: (patch: Partial<UiState> | ((s: UiState) => Partial<UiState>)) => void;
  route: Route;
  data: Data;
  /** Navigate (and optionally set UI state, e.g. which tab opens). */
  go: (n: string, id?: string | null, extra?: Partial<UiState>) => void;
  toast: (msg: string, action?: { label: string; fn: () => void }) => void;
  openModal: (kind: string, data?: Record<string, unknown>, mf?: Record<string, unknown>) => void;
  actions: Actions;
  mobile: boolean;
}
