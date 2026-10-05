/** Issued inspection reports (frozen snapshots). */
import type { L10n } from "./common";

export interface ReportSnapshot {
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
