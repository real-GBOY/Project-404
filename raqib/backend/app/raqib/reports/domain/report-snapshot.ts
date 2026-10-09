import type { InspectionView } from "@raqib/raqib/inspections/application/inspections-service.js";
import { visitScore } from "@raqib/raqib/inspections/domain/scoring.js";
import type { VisitView } from "@raqib/raqib/visits/application/visits-service.js";
import type { L10n } from "@raqib/raqib/shared/l10n.js";

export interface SnapshotItem {
  num: string;
  text: L10n;
  weight: number;
  answer: string | null;
  note: string;
  evidence: Array<{ id: string; name: string; kind: string; mime: string }>;
}
export interface SnapshotViolation {
  ref: string;
  num: string | null;
  text: L10n;
  note: string;
  severity: string;
  repeatCount: number;
}

/** One form's part of a report: its own issue number, version, score, items and violations. */
export interface FormPart {
  issueNo: string;
  form: { code: string; version: string; name: L10n };
  round: number;
  score: { pct: number | null; compliant: number; nonCompliant: number; na: number; evidence: number };
  /** The deduction rules this form was scored under, and what each violation cost (absent for the weighted policy). */
  scoring?: { policy: string; version: number | null; deductions: Array<{ num: string | null; text: L10n; severity: string | null; amount: number }> };
  sections: Array<{ title: L10n; items: SnapshotItem[] }>;
  violations: SnapshotViolation[];
}

/**
 * Everything an issued report says, frozen at approval. Names, titles, scores and wording are copied in, never
 * referenced, so renaming a project or editing a form later cannot change what was approved.
 *
 * The top-level `form`, `round`, `score`, `sections` and `violations` describe the visit's first form (reports issued
 * before multi-form visits have only these); `extraForms` carries the other forms of a visit that required several.
 */
export interface ReportSnapshot {
  version: 1;
  /** The organization's name (and logo file) as they were when the report was issued. Older reports have none. */
  org?: { name: L10n; logoFileId: string | null };
  ref: string;
  visitRef: string;
  issuedAt: string;
  project: { code: string; name: L10n };
  site: L10n;
  area: L10n | string | null;
  type: string;
  shift: string;
  /** The shift's name as configured when the report was issued (older reports show the key). */
  shiftName?: L10n;
  date: string;
  time: string;
  inspector: L10n | null;
  /** Issue number of the first form's inspection (absent on older reports). */
  issueNo?: string;
  form: { code: string; version: string; name: L10n };
  round: number;
  score: { pct: number | null; compliant: number; nonCompliant: number; na: number; evidence: number };
  scoring?: FormPart["scoring"];
  /** Mean of the forms' scores when the visit had several forms. */
  overallPct?: number | null;
  extraForms?: FormPart[];
  sections: FormPart["sections"];
  violations: SnapshotViolation[];
  guards: Array<{ employeeNo: string; name: L10n; pct: number | null; note: string }>;
  decisions: Array<{ action: string; at: string; reason: string | null; actor: { name: L10n; title: L10n; role: string | null } }>;
  approvedBy: { name: L10n; title: L10n };
}

export interface GuardLite {
  employeeNo: string;
  name: L10n;
}

type ViolationRow = { ref: string; itemNum: string | null; title: L10n; note: string; severity: string; repeatCount: number };

const toViolations = (rows: ViolationRow[]): SnapshotViolation[] =>
  rows.map((o) => ({ ref: o.ref, num: o.itemNum, text: o.title, note: o.note, severity: o.severity, repeatCount: o.repeatCount }));

function partOf(ins: InspectionView, violations: ViolationRow[]): FormPart {
  const items = ins.sections.flatMap((s) => s.items);
  const deductions = ins.score.deductions?.map((d) => {
    const it = items.find((x) => x.id === d.itemId);
    return { num: it?.num ?? null, text: it?.text ?? { ar: d.itemKey, en: d.itemKey }, severity: d.severity, amount: d.amount };
  });
  return {
    issueNo: ins.issueNo,
    form: { code: ins.form.code, version: ins.form.version, name: ins.form.name },
    round: ins.round,
    score: { pct: ins.score.pct, compliant: ins.score.compliant, nonCompliant: ins.score.nonCompliant, na: ins.score.na, evidence: ins.score.evidence },
    ...(deductions ? { scoring: { policy: ins.scoring.policy, version: ins.scoring.version, deductions } } : {}),
    sections: ins.sections.map((s) => ({
      title: s.title,
      items: s.items.map((it) => ({
        num: it.num,
        text: it.text,
        weight: it.weight,
        answer: it.answer,
        note: it.note,
        evidence: it.evidence.map((e) => ({ id: e.id, name: e.name, kind: e.kind, mime: e.mime })),
      })),
    })),
    violations: toViolations(violations),
  };
}

export function buildSnapshot(args: {
  ref: string;
  issuedAt: Date;
  visit: VisitView;
  /** The visit's inspections in the order its forms are required; the first is the lead. */
  inspections: Array<{ inspection: InspectionView; violations: ViolationRow[] }>;
  guards: Map<string, GuardLite>;
  approver: { nameAr: string; nameEn: string; titleAr: string; titleEn: string };
  shiftName?: L10n;
  org?: { name: L10n; logoFileId: string | null };
}): ReportSnapshot {
  const { visit: v } = args;
  const [lead, ...others] = args.inspections.map((x) => partOf(x.inspection, x.violations));
  if (!lead) throw new Error("A report needs at least one inspection");
  const leadView = args.inspections[0]!.inspection;
  return {
    version: 1,
    ...(args.org ? { org: args.org } : {}),
    ref: args.ref,
    visitRef: v.ref,
    issuedAt: args.issuedAt.toISOString(),
    project: { code: v.project.code, name: v.project.name },
    site: v.site.name,
    area: v.area,
    type: v.type,
    shift: v.shift,
    ...(args.shiftName ? { shiftName: args.shiftName } : {}),
    date: v.date,
    time: v.time,
    inspector: v.inspector?.name ?? null,
    issueNo: lead.issueNo,
    form: lead.form,
    round: lead.round,
    score: lead.score,
    ...(lead.scoring ? { scoring: lead.scoring } : {}),
    ...(others.length ? { overallPct: visitScore(args.inspections.map((x) => x.inspection.score.pct)), extraForms: others } : {}),
    sections: lead.sections,
    violations: lead.violations,
    guards: leadView.guards.map((g) => {
      const info = args.guards.get(g.guardId);
      return { employeeNo: info?.employeeNo ?? "", name: info?.name ?? { ar: "—", en: "—" }, pct: g.pct, note: g.note };
    }),
    decisions: v.history
      .filter((h) => ["submitted", "resubmitted", "reviewed", "returned", "approved", "rejected"].includes(h.action))
      .map((h) => ({ action: h.action, at: h.at, reason: h.reason, actor: { name: h.actor.name, title: h.actor.title, role: h.actor.role } })),
    approvedBy: { name: { ar: args.approver.nameAr, en: args.approver.nameEn }, title: { ar: args.approver.titleAr, en: args.approver.titleEn } },
  };
}
