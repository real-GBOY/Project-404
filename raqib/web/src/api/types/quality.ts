/** Observations and corrective actions. */
import type { L10n } from "./common";
import type { EvidenceItem } from "./inspection";

export type Severity = "low" | "medium" | "high";

export type ActionStatus = "assigned" | "in_progress" | "quality_review" | "returned" | "closed";

export type ActionDisplayStatus = ActionStatus | "overdue";

export interface Observation {
  id: string;
  ref: string;
  kind: "violation" | "observation";
  title: L10n;
  note: string;
  severity: Severity;
  repeatCount: number;
  project: { id: string; code: string; name: L10n };
  site: L10n;
  visit: { id: string; ref: string } | null;
  itemNum: string | null;
  itemKey: string | null;
  reportedBy: L10n;
  createdAt: string;
  action: {
    id: string;
    ref: string;
    status: ActionDisplayStatus;
    dueDate: string;
    priority: Severity;
    responsible: L10n;
  } | null;
}

export interface ActionLogEntry {
  id: string;
  kind: "created" | "started" | "submitted" | "comment" | "returned" | "closed" | "reassigned";
  from: string | null;
  to: string | null;
  text: string | null;
  at: string;
  actor: { id: string | null; name: L10n; role: string | null; title: L10n };
}

export interface CorrectiveAction {
  id: string;
  ref: string;
  title: L10n;
  description: string;
  priority: Severity;
  status: ActionDisplayStatus;
  storedStatus: ActionStatus;
  dueDate: string;
  round: number;
  project: { id: string; code: string; name: L10n };
  responsible: { id: string; name: L10n };
  observation: {
    id: string;
    ref: string;
    kind: string;
    severity: Severity;
    repeatCount: number;
    itemNum: string | null;
    site: L10n;
  };
  visit: { id: string; ref: string } | null;
  createdAt: string;
  closedAt: string | null;
  log?: ActionLogEntry[];
  evidence?: EvidenceItem[];
}

export interface ResponsibleOption {
  id: string;
  name: L10n;
  title: L10n;
}
