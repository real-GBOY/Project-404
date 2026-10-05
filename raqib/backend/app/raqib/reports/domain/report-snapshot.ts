import type { InspectionView } from "@raqib/raqib/inspections/application/inspections-service.js";
import type { VisitView } from "@raqib/raqib/visits/application/visits-service.js";
import type { L10n } from "@raqib/raqib/shared/l10n.js";

/**
 * Everything an issued report says, frozen at approval. Names, titles, scores and wording are copied in, never
 * referenced, so renaming a project or editing a form later cannot change what was approved.
 */
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
  score: { pct: number | null; compliant: number; nonCompliant: number; na: number; evidence: number };
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
  decisions: Array<{ action: string; at: string; reason: string | null; actor: { name: L10n; title: L10n; role: string | null } }>;
  approvedBy: { name: L10n; title: L10n };
}

export interface GuardLite {
  employeeNo: string;
  name: L10n;
}

export function buildSnapshot(args: {
  ref: string;
  issuedAt: Date;
  visit: VisitView;
  inspection: InspectionView;
  guards: Map<string, GuardLite>;
  approver: { nameAr: string; nameEn: string; titleAr: string; titleEn: string };
}): ReportSnapshot {
  const { visit: v, inspection: ins } = args;
  return {
    version: 1,
    ref: args.ref,
    visitRef: v.ref,
    issuedAt: args.issuedAt.toISOString(),
    project: { code: v.project.code, name: v.project.name },
    site: v.site.name,
    area: v.area,
    type: v.type,
    shift: v.shift,
    date: v.date,
    time: v.time,
    inspector: v.inspector?.name ?? null,
    form: { code: ins.form.code, version: ins.form.version, name: ins.form.name },
    round: ins.round,
    score: { pct: ins.score.pct, compliant: ins.score.compliant, nonCompliant: ins.score.nonCompliant, na: ins.score.na, evidence: ins.score.evidence },
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
    guards: ins.guards.map((g) => {
      const info = args.guards.get(g.guardId);
      return { employeeNo: info?.employeeNo ?? "", name: info?.name ?? { ar: "—", en: "—" }, pct: g.pct, note: g.note };
    }),
    decisions: v.history
      .filter((h) => ["submitted", "resubmitted", "reviewed", "returned", "approved", "rejected"].includes(h.action))
      .map((h) => ({ action: h.action, at: h.at, reason: h.reason, actor: { name: h.actor.name, title: h.actor.title, role: h.actor.role } })),
    approvedBy: { name: { ar: args.approver.nameAr, en: args.approver.nameEn }, title: { ar: args.approver.titleAr, en: args.approver.titleEn } },
  };
}
