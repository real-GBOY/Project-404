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

/** One of a visit's required forms and how far it has got. */
export interface VisitFormProgress {
  formId: string;
  code: string;
  name: L10n;
  position: number;
  issueNo: string | null;
  inspectionId: string | null;
  started: boolean;
  answered: number;
  total: number;
  /** Items still blocking submission. */
  blocking: number;
  submitted: boolean;
}

export interface Inspection {
  id: string;
  visitId: string;
  ref: string;
  /** Unique number of this form inspection. */
  issueNo: string;
  formId: string;
  /** 0 = the visit's lead form. */
  position: number;
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
    /** False for roles that only inspect: the percentage is withheld by the server. */
    visible: boolean;
    /** Under deduction scoring: what each violation costs (only for roles that may see the score). */
    deductions?: Array<{ itemKey: string; severity: string | null; amount: number }>;
  };
  issues: InspectionIssue[];
  editable: boolean;
  submittedAt: string | null;
  startedAt: string;
}
