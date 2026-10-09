/** Scheduled visits and their workflow. */
import type { L10n } from "./common";

export type VisitType = "routine" | "surprise" | "follow" | "night";

/** A configured shift key (the organization defines them; "morning", "evening" and "night" are the original three). */
export type Shift = string;

/** A form a scheduler can require on a visit. */
export interface FormOption {
  id: string;
  code: string;
  name: L10n;
  version: string;
  isDefault: boolean;
}

/** A shift as the organization configured it; `start`/`end` are "HH:MM" or empty until set. */
export interface ShiftDef {
  key: string;
  name: L10n;
  start: string;
  end: string;
}

export type VisitStatus =
  | "scheduled"
  | "assigned"
  | "in_progress"
  | "pending_review"
  | "pending_approval"
  | "returned"
  | "approved"
  | "rejected"
  | "cancelled";

/** `overdue` is derived by the backend from the schedule; it is never a stored status. */
export type DisplayStatus = VisitStatus | "overdue";

export interface VisitHistoryEntry {
  action: string;
  from: string | null;
  to: string;
  at: string;
  reason: string | null;
  actor: { id: string | null; name: L10n; role: string | null; title: L10n };
}

export interface Visit {
  id: string;
  ref: string;
  project: { id: string; code: string; name: L10n };
  site: { id: string; name: L10n };
  area: L10n | string | null;
  inspector: { id: string; name: L10n; ini: L10n } | null;
  type: VisitType;
  shift: Shift;
  date: string;
  time: string;
  status: DisplayStatus;
  storedStatus: VisitStatus;
  round: number;
  guardIds: string[];
  /** Forms this visit requires, in order (empty = the default site form). */
  forms: Array<{ id: string; code: string; name: L10n }>;
  scorePct: number | null;
  inspectionId: string | null;
  history: VisitHistoryEntry[];
  createdAt: string;
}

export interface CreateVisitInput {
  projectId: string;
  siteId: string;
  areaId?: string | null;
  areaText?: string | null;
  inspectorId?: string | null;
  type: VisitType;
  shift: Shift;
  date: string;
  time: string;
  formIds?: string[];
  reason: string;
}

export interface RescheduleVisitInput {
  date: string;
  time: string;
  inspectorId?: string | null;
  reason: string;
}

export interface EligibleInspector {
  id: string;
  name: L10n;
  ini: L10n;
}
