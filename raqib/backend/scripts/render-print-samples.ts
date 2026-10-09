/**
 * Renders the printable report and the blank form to HTML files, from synthetic data with long Arabic and English
 * text, so the layout (A4, page numbers, repeated table headings, wrapping, RTL) can be checked by printing them to PDF.
 *
 *   node --import @swc-node/register/esm-register scripts/render-print-samples.ts <outDir>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderBlankFormHtml } from "../app/raqib/forms/domain/blank-form-html.js";
import { renderReportHtml } from "../app/raqib/reports/domain/report-html.js";
import type { FormPart, ReportSnapshot } from "../app/raqib/reports/domain/report-snapshot.js";

const out = process.argv[2] ?? "print-samples";
mkdirSync(out, { recursive: true });

const L = (ar: string, en: string) => ({ ar, en });
const LONG_AR =
  "لم يتم التحقق من هوية الزائر عند البوابة الرئيسية خلال فترة المراقبة، وتم السماح بدخول عدد من المركبات دون تسجيلها في السجل المخصص لذلك، مما يخالف إجراءات الأمن المعتمدة للموقع ويستوجب إجراءً تصحيحيًا فوريًا.";
const LONG_EN =
  "Visitor identity was not verified at the main gate during the observation period, and several vehicles entered without being entered in the dedicated log, which breaches the approved site security procedures and requires immediate corrective action.";
const WORD = "UnbrokenIdentifier_ABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789_ABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789";

const items = (n: number, offset = 0) =>
  Array.from({ length: n }, (_, k) => ({
    num: `${offset + 1}.${k + 1}`,
    text: L(`البند رقم ${k + 1}: ${LONG_AR.slice(0, 60 + (k % 4) * 20)}`, `Item ${k + 1}: ${LONG_EN.slice(0, 60 + (k % 4) * 20)}`),
    weight: 1 + (k % 4),
    answer: k % 7 === 3 ? "n" : k % 11 === 5 ? "x" : "c",
    note: k % 7 === 3 ? (k % 2 ? `${LONG_AR} ${LONG_EN}` : WORD) : "",
    evidence: [],
  }));

const part = (code: string, issueNo: string, name: L10n, sections: number, per: number): FormPart => ({
  issueNo,
  form: { code, version: "2.1", name },
  round: 1,
  score: { pct: 88, compliant: 40, nonCompliant: 5, na: 2, evidence: 3 },
  scoring: {
    policy: "deduction_v1",
    version: 3,
    deductions: [
      { num: "1.4", text: L("لا يوجد سجل زوار", "No visitor log"), severity: "high", amount: 10 },
      { num: "2.4", text: L(LONG_AR, LONG_EN), severity: "medium", amount: 5 },
    ],
  },
  sections: Array.from({ length: sections }, (_, s) => ({
    title: L(`القسم ${s + 1} — الوصول والتحكم`, `Section ${s + 1} — Access and control`),
    items: items(per, s),
  })),
  violations: [{ ref: "OBS-26-0001", num: "1.4", text: L(LONG_AR, LONG_EN), note: WORD, severity: "high", repeatCount: 2 }],
});
type L10n = { ar: string; en: string };

const snapshot: ReportSnapshot = {
  version: 1,
  ref: "RPT-26-0042",
  visitRef: "VIS-26-0042",
  issuedAt: "2026-10-09T08:00:00.000Z",
  project: { code: "PRJ-RYD-014", name: L("مجمع الأعمال - الرياض", "Riyadh Business Park") },
  site: L("البوابة الرئيسية", "Main gate"),
  area: L("بوابة المركبات", "Vehicle gate"),
  type: "routine",
  shift: "morning",
  date: "2026-10-08",
  time: "09:30",
  inspector: L("خالد الشهري", "Khalid Al-Shehri"),
  issueNo: "INS-26-0101",
  overallPct: 91,
  ...(() => {
    const lead = part("FRM-SEC-01", "INS-26-0101", L("نموذج تفتيش الموقع الأمني", "Site security inspection form"), 3, 9);
    return { form: lead.form, round: 1, score: lead.score, scoring: lead.scoring, sections: lead.sections, violations: lead.violations };
  })(),
  extraForms: [part("FRM-HSP-01", "INS-26-0102", L("نموذج الصحة والسلامة", "Health and safety form"), 2, 7)],
  guards: [
    { employeeNo: "G-10234", name: L("فيصل الدوسري", "Faisal Al-Dosari"), pct: 82, note: LONG_EN },
    { employeeNo: "G-10251", name: L("سلمان العتيبي", "Salman Al-Otaibi"), pct: null, note: "" },
  ],
  decisions: [
    {
      action: "submitted",
      at: "2026-10-08T10:00:00Z",
      reason: null,
      actor: { name: L("خالد الشهري", "Khalid Al-Shehri"), title: L("مفتش جودة", "Quality Inspector"), role: "ins" },
    },
    {
      action: "reviewed",
      at: "2026-10-08T12:00:00Z",
      reason: "Checked against the log.",
      actor: { name: L("نورة القحطاني", "Noura Al-Qahtani"), title: L("أخصائية جودة", "Quality Specialist"), role: "qe" },
    },
    {
      action: "approved",
      at: "2026-10-09T08:00:00Z",
      reason: null,
      actor: { name: L("سعود العتيبي", "Saud Al-Otaibi"), title: L("مدير إدارة الجودة", "Director of Quality"), role: "qm" },
    },
  ],
  approvedBy: { name: L("سعود العتيبي", "Saud Al-Otaibi"), title: L("مدير إدارة الجودة", "Director of Quality") },
};

for (const lang of ["ar", "en"] as const) {
  writeFileSync(join(out, `report-${lang}.html`), renderReportHtml(snapshot, lang, new Map()), "utf8");
  writeFileSync(
    join(out, `blank-${lang}.html`),
    renderBlankFormHtml(
      { code: "FRM-SEC-01", name: L("نموذج تفتيش الموقع الأمني", "Site security inspection form"), version: "2.1" },
      snapshot.sections.map((s) => ({
        key: "s",
        title: s.title,
        items: s.items.map((it, k) => ({
          key: `k${k}`,
          text: it.text,
          weight: it.weight,
          type: (["cnx", "yesno", "scale5", "text"] as const)[k % 4]!,
          required: true,
          na: k % 2 === 0,
          evidenceOnNc: false,
        })),
      })),
      lang,
    ),
    "utf8",
  );
}
console.log(`wrote samples to ${out}`);
