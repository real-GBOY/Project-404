/** Issued inspection reports (frozen snapshots). */
import type { L10n } from "./common";

export interface SnapshotItem {
  num: string;
  text: L10n;
  weight: number;
  answer: string | null;
  note: string;
  evidence: Array<{ id: string; name: string; kind: string; mime: string }>;
}
export interface SnapshotViolation {
  num: string;
  ref: string;
  note: string;
  text: L10n;
  severity: string;
  repeatCount: number;
}
/** One form of a visit as the report froze it. */
export interface SnapshotFormPart {
  issueNo: string;
  form: { code: string; version: string; name: L10n };
  round: number;
  score: {
    pct: number | null;
    compliant: number;
    nonCompliant: number;
    na: number;
    evidence: number;
  };
  /** What each violation cost under the deduction rules (absent for the earlier weighted scoring). */
  scoring?: {
    policy: string;
    version: number | null;
    deductions: Array<{ num: string | null; text: L10n; severity: string | null; amount: number }>;
  };
  sections: Array<{ title: L10n; items: SnapshotItem[] }>;
  violations: SnapshotViolation[];
}

export interface ReportSnapshot {
  issueNo?: string;
  scoring?: SnapshotFormPart["scoring"];
  /** Mean of the forms' scores when the visit had several forms. */
  overallPct?: number | null;
  /** The visit's other forms (the top-level fields describe the first). */
  extraForms?: SnapshotFormPart[];
  violations?: SnapshotViolation[];
  version: 1;
  ref: string;
  visitRef: string;
  issuedAt: string;
  project: { code: string; name: L10n };
  site: L10n;
  area: L10n | string | null;
  type: string;
  shift: string;
  date: string;
  time: string;
  inspector: L10n | null;
  form: { code: string; version: string; name: L10n };
  round: number;
  score: {
    pct: number | null;
    compliant: number;
    nonCompliant: number;
    na: number;
    evidence: number;
  };
  sections: Array<{
    title: L10n;
    items: Array<{
      num: string;
      text: L10n;
      weight: number;
      answer: string | null;
      note: string;
      evidence: Array<{ id: string; name: string; kind: string; mime: string }>;
    }>;
  }>;
  guards: Array<{ employeeNo: string; name: L10n; pct: number | null; note: string }>;
  decisions: Array<{
    action: string;
    at: string;
    reason: string | null;
    actor: { name: L10n; title: L10n; role: string | null };
  }>;
  approvedBy: { name: L10n; title: L10n };
}

export interface Report {
  id: string;
  ref: string;
  visitId: string;
  projectId: string;
  scorePct: number | null;
  issuedAt: string;
  snapshot: ReportSnapshot;
}
