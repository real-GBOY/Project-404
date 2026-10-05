/** An inspection in progress or submitted: answers, evidence, guard evaluations, issues. */
import type { L10n } from "./common";

export type Answer = "c" | "n" | "x" | null;

export interface EvidenceItem {
  id: string;
  name: string;
  kind: "photo" | "video" | "doc";
  mime: string;
  sizeBytes: number;
  at: string;
  by: string | null;
}

export interface InspectionItem {
  id: string;
  key: string;
  num: string;
  text: L10n;
  weight: number;
  required: boolean;
  na: boolean;
  evidenceOnNc: boolean;
  answer: Answer;
  note: string;
  severity: "low" | "medium" | "high" | null;
  evidence: EvidenceItem[];
  flagged: boolean;
  fixed: boolean;
  locked: boolean;
}

export interface GuardEvaluation {
  guardId: string;
  scores: Record<string, number>;
  note: string;
  evidence: EvidenceItem[];
  pct: number | null;
  done: boolean;
  answered: number;
}

export interface InspectionIssue {
  code:
    | "unanswered"
    | "note_required"
    | "evidence_required"
    | "evidence_pending"
    | "flag_untouched"
    | "guard_incomplete";
  at: string;
  step: number;
}

export interface Inspection {
  id: string;
  visitId: string;
  ref: string;
  status: string;
  round: number;
  form: { versionId: string; code: string; version: string; name: L10n };
  sections: Array<{ key: string; title: L10n; items: InspectionItem[] }>;
  guardCriteria: Array<{ id: string; key: string; text: L10n }>;
  guards: GuardEvaluation[];
  previous: Array<{ round: number; itemIds: string[] }>;
  score: {
    pct: number | null;
    answered: number;
    total: number;
    compliant: number;
    nonCompliant: number;
    na: number;
    evidence: number;
  };
  issues: InspectionIssue[];
  editable: boolean;
  submittedAt: string | null;
  startedAt: string;
}
