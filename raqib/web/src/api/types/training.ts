/** Guard training requests and guard records. */
import type { L10n } from "./common";
import type { Severity } from "./quality";

export type TrainingStatus =
  "pending_pm" | "returned" | "rejected" | "approved" | "scheduled" | "completed";

export type TrainingReason =
  "low_score" | "repeat_issue" | "incident" | "refresher" | "new_assignment";

export type TrainingResult = "passed" | "attended" | "failed";

export interface TrainingRequest {
  id: string;
  ref: string;
  guard: { id: string; employeeNo: string; name: L10n };
  project: { id: string; code: string; name: L10n };
  reason: TrainingReason;
  course: string;
  related: string;
  priority: Severity;
  notes: string;
  status: TrainingStatus;
  round: number;
  escalated: boolean;
  requestedBy: L10n | null;
  requestedById: string | null;
  scheduledDate: string | null;
  provider: string | null;
  completedDate: string | null;
  result: TrainingResult | null;
  resultNote: string | null;
  createdAt: string;
  log?: Array<{
    id: string;
    kind: string;
    to: string;
    text: string | null;
    at: string;
    actor: { id: string | null; name: L10n; role: string | null; title: L10n };
  }>;
}

export interface GuardHistory {
  guard: { id: string; employeeNo: string; name: L10n; post: L10n };
  evaluations: Array<{
    reportId: string;
    reportRef: string;
    visitId: string;
    visitRef: string;
    date: string;
    pct: number | null;
    note: string;
    site: L10n;
  }>;
  average: number | null;
  training: TrainingRequest[];
}

export type GuardSummaries = Record<
  string,
  { average: number | null; evaluations: number; lastPct: number | null }
>;
