import type { L10n } from "@raqib/raqib/shared/l10n.js";
import type { FormPart, ReportSnapshot } from "./report-snapshot.js";
import { COMMON, brandBar, esc, ltr, printCss, type Lang } from "./print-kit.js";

export type { Lang } from "./print-kit.js";

const STR = {
  title: { ar: "تقرير تفتيش", en: "Inspection report" },
  ref: { ar: "رقم التقرير", en: "Report no." },
  visit: { ar: "رقم الزيارة", en: "Visit no." },
  score: { ar: "النتيجة", en: "Score" },
  overall: { ar: "النتيجة العامة للزيارة", en: "Overall visit score" },
  formsInVisit: { ar: "النماذج في هذه الزيارة", en: "Forms in this visit" },
  compliant: { ar: "مطابق", en: "Compliant" },
  nonCompliant: { ar: "غير مطابق", en: "Non-compliant" },
  na: { ar: "لا ينطبق", en: "N/A" },
  evidence: { ar: "الأدلة", en: "Evidence" },
  guards: { ar: "تقييم الحراس", en: "Guard evaluations" },
  violations: { ar: "المخالفات", en: "Violations" },
  deductions: { ar: "الخصومات", en: "Deductions" },
  deductionRules: { ar: "قواعد الخصم", en: "Deduction rules" },
  points: { ar: "نقاط", en: "pts" },
  severityCol: { ar: "الخطورة", en: "Severity" },
  severity: { low: { ar: "منخفضة", en: "Low" }, medium: { ar: "متوسطة", en: "Medium" }, high: { ar: "عالية", en: "High" } } as Record<string, L10n>,
  repeat: { ar: "تكرار", en: "Repeat" },
  decisions: { ar: "مسار القرارات", en: "Decision trail" },
  action: { ar: "الإجراء", en: "Action" },
  by: { ar: "بواسطة", en: "By" },
  when: { ar: "الوقت", en: "When" },
  approvedBy: { ar: "اعتمد بواسطة", en: "Approved by" },
  issued: { ar: "أُصدر في", en: "Issued" },
  notAnswered: { ar: "—", en: "—" },
  guard: { ar: "الحارس", en: "Guard" },
  employeeNo: { ar: "الرقم الوظيفي", en: "Employee no." },
  roleInspector: { ar: "المفتش", en: "Inspector" },
  roleReviewer: { ar: "مراجع الجودة", en: "Quality reviewer" },
  roleApprover: { ar: "المعتمد", en: "Approver" },
  immutable: { ar: "هذا التقرير نسخة مجمدة وقت الاعتماد ولا يمكن تعديلها.", en: "This report is a frozen copy taken at approval and cannot be altered." },
  actions: {
    submitted: { ar: "تم الإرسال", en: "Submitted" },
    resubmitted: { ar: "أُعيد الإرسال", en: "Resubmitted" },
    reviewed: { ar: "تمت المراجعة", en: "Reviewed" },
    returned: { ar: "أُعيد للمفتش", en: "Returned" },
    approved: { ar: "اعتُمد", en: "Approved" },
    rejected: { ar: "رُفض", en: "Rejected" },
  } as Record<string, L10n>,
  answers: { c: { ar: "مطابق", en: "Compliant" }, n: { ar: "غير مطابق", en: "Non-compliant" }, x: { ar: "لا ينطبق", en: "N/A" } } as Record<string, L10n>,
};

/** Reports issued before shift names were stored: the three original shifts keep their names. */
const BUILTIN_SHIFT: Record<string, L10n> = {
  morning: { ar: "صباحية", en: "Morning" },
  evening: { ar: "مسائية", en: "Evening" },
  night: { ar: "ليلية", en: "Night" },
};

const toneOf = (pct: number | null): string => (pct == null ? "#6b7280" : pct >= 90 ? "#1e6b45" : pct >= 75 ? "#8a5a00" : "#a3262a");

/**
 * The printable report: one self-contained HTML page for A4 (no network; photos are inlined as data URIs by the caller).
 * Each form of the visit is its own part starting on a new page, with its own issue number, score and tables whose heading
 * row repeats on every page. Arabic renders right-to-left; numbers keep Western digits so references match.
 */
export function renderReportHtml(s: ReportSnapshot, lang: Lang, images: Map<string, string>): string {
  const L = (x: L10n): string => esc(x[lang]);
  const T = (k: L10n): string => k[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";
  const area = s.area == null ? "—" : typeof s.area === "string" ? esc(s.area) : L(s.area);
  const when = (iso: string): string => ltr(new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC");
  const pctText = (p: number | null | undefined): string => (p == null ? "—" : `${p}%`);

  const leadPart: FormPart = {
    issueNo: s.issueNo ?? "",
    form: s.form,
    round: s.round,
    score: s.score,
    ...(s.scoring ? { scoring: s.scoring } : {}),
    sections: s.sections,
    violations: s.violations,
  };
  const parts: FormPart[] = [leadPart, ...(s.extraForms ?? [])];
  const headline = s.overallPct !== undefined ? s.overallPct : s.score.pct;

  const renderPart = (p: FormPart, index: number): string => {
    const sections = p.sections
      .map((sec, si) => {
        const rows = sec.items
          .map((it) => {
            const ans = it.answer ? T(STR.answers[it.answer] ?? STR.notAnswered) : T(STR.notAnswered);
            const color = it.answer === "c" ? "#1e6b45" : it.answer === "n" ? "#a3262a" : "#6b7280";
            const imgs = it.evidence
              .filter((e) => e.kind === "photo" && images.has(e.id))
              .map((e) => `<img src="${images.get(e.id)}" alt="${esc(e.name)}">`)
              .join("");
            const other = it.evidence
              .filter((e) => !(e.kind === "photo" && images.has(e.id)))
              .map((e) => `<span class="chip">${esc(e.name)}</span>`)
              .join("");
            return `<tr><td class="c-num">${esc(it.num)}</td><td><div>${L(it.text)}</div>${it.note ? `<div class="note">${T(COMMON.note)}: ${esc(it.note)}</div>` : ""}${imgs ? `<div class="imgs">${imgs}</div>` : ""}${other ? `<div>${other}</div>` : ""}</td><td class="c-ans" style="color:${color}">${esc(ans)}</td><td class="c-w">${it.weight}</td></tr>`;
          })
          .join("");
        return `<h3>${si + 1}. ${L(sec.title)}</h3><table><thead><tr><th class="c-num">${T(COMMON.no)}</th><th>${T(COMMON.requirement)}</th><th class="c-ans">${T(COMMON.result)}</th><th class="c-w">${T(COMMON.weight)}</th></tr></thead><tbody>${rows}</tbody></table>`;
      })
      .join("");

    const deductions = p.scoring?.deductions.length
      ? `<h2>${T(STR.deductions)}${p.scoring.version != null ? ` · ${T(STR.deductionRules)} v${p.scoring.version}` : ""}</h2><table><thead><tr><th class="c-num">${T(COMMON.no)}</th><th>${T(COMMON.requirement)}</th><th class="c-ans">${T(STR.severityCol)}</th><th class="c-w">${T(STR.points)}</th></tr></thead><tbody>${p.scoring.deductions
          .map(
            (d) =>
              `<tr><td class="c-num">${esc(d.num ?? "")}</td><td>${L(d.text)}</td><td class="c-ans">${d.severity ? esc(T(STR.severity[d.severity] ?? STR.severity.medium!)) : "—"}</td><td class="c-w" style="color:#a3262a">−${d.amount}</td></tr>`,
          )
          .join("")}</tbody></table>`
      : "";

    const violations = p.violations.length
      ? `<h2>${T(STR.violations)}</h2><table><thead><tr><th class="c-num">${T(COMMON.no)}</th><th>${T(COMMON.requirement)}</th><th class="c-ans">${T(STR.severityCol)}</th></tr></thead><tbody>${p.violations
          .map(
            (o) =>
              `<tr><td class="c-num">${esc(o.num ?? "")}</td><td>${L(o.text)}${o.note ? `<div class="note">${esc(o.note)}</div>` : ""}<div class="note">${ltr(o.ref)}</div></td><td class="c-ans" style="color:#a3262a">${esc(T(STR.severity[o.severity] ?? STR.severity.medium!))}${o.repeatCount ? ` · ${T(STR.repeat)} ×${o.repeatCount}` : ""}</td></tr>`,
          )
          .join("")}</tbody></table>`
      : "";

    const guards =
      index === 0 && s.guards.length
        ? `<h2>${T(STR.guards)}</h2><table><thead><tr><th class="c-id">${T(STR.employeeNo)}</th><th>${T(STR.guard)}</th><th class="c-ans">${T(STR.score)}</th></tr></thead><tbody>${s.guards
            .map(
              (g) =>
                `<tr><td class="c-id">${ltr(g.employeeNo)}</td><td>${L(g.name)}${g.note ? `<div class="note">${esc(g.note)}</div>` : ""}</td><td class="c-ans">${pctText(g.pct)}</td></tr>`,
            )
            .join("")}</tbody></table>`
        : "";

    return `<section class="form-part">
<div class="head"><div><h1>${L(p.form.name)}</h1><div>${ltr(p.form.code)} · ${T(COMMON.version)} ${ltr(p.form.version)}${p.issueNo ? ` · ${T(COMMON.issueNo)} ${ltr(p.issueNo)}` : ""}</div></div>${parts.length > 1 ? `<div class="score"><b style="color:${toneOf(p.score.pct)}">${pctText(p.score.pct)}</b>${T(STR.score)}</div>` : ""}</div>
<div class="stats"><div>${T(STR.compliant)}: <b>${p.score.compliant}</b></div><div>${T(STR.nonCompliant)}: <b>${p.score.nonCompliant}</b></div><div>${T(STR.na)}: <b>${p.score.na}</b></div><div>${T(STR.evidence)}: <b>${p.score.evidence}</b></div></div>
${sections}${deductions}${violations}${guards}
</section>`;
  };

  const overview =
    parts.length > 1
      ? `<h2>${T(STR.formsInVisit)}</h2><table><thead><tr><th class="c-id">${T(COMMON.issueNo)}</th><th>${T(COMMON.form)}</th><th class="c-ans">${T(STR.score)}</th></tr></thead><tbody>${parts
          .map(
            (p) =>
              `<tr><td class="c-id">${ltr(p.issueNo)}</td><td>${L(p.form.name)} · ${ltr(`${p.form.code} v${p.form.version}`)}</td><td class="c-ans" style="color:${toneOf(p.score.pct)}">${pctText(p.score.pct)}</td></tr>`,
          )
          .join("")}</tbody></table>`
      : "";

  const trail = s.decisions
    .map(
      (d) =>
        `<tr><td>${esc(T(STR.actions[d.action] ?? { ar: d.action, en: d.action }))}</td><td>${L(d.actor.name)} · ${L(d.actor.title)}</td><td class="c-when">${when(d.at)}</td></tr>${d.reason ? `<tr><td></td><td colspan="2" class="note">${esc(d.reason)}</td></tr>` : ""}`,
    )
    .join("");

  const reviewer = [...s.decisions].reverse().find((d) => d.action === "reviewed");
  const sign = `<div class="sign">
<div><b>${T(STR.roleInspector)}</b>${s.inspector ? L(s.inspector) : "—"}</div>
<div><b>${T(STR.roleReviewer)}</b>${reviewer ? L(reviewer.actor.name) : "—"}</div>
<div><b>${T(STR.roleApprover)}</b>${L(s.approvedBy.name)}</div>
</div>`;

  return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><title>${esc(s.ref)}</title><style>${printCss(lang, s.ref)}</style></head><body class="${parts.length > 1 ? "multi" : ""}">
${s.org ? brandBar(s.org.name[lang], images.get("__logo__") ?? null) : ""}
<div class="head"><div><h1>${T(STR.title)}</h1><div>${ltr(s.ref)}</div></div><div class="score"><b style="color:${toneOf(headline ?? null)}">${pctText(headline)}</b>${T(parts.length > 1 ? STR.overall : STR.score)}</div></div>
<div class="meta">
<div><span>${T(STR.visit)}:</span> ${ltr(s.visitRef)}</div><div><span>${T(COMMON.shift)}:</span> ${s.shiftName ? L(s.shiftName) : BUILTIN_SHIFT[s.shift] ? esc(BUILTIN_SHIFT[s.shift]![lang]) : esc(s.shift)}</div>
<div><span>${T(COMMON.project)}:</span> ${L(s.project.name)}</div><div><span>${T(COMMON.site)}:</span> ${L(s.site)}</div>
<div><span>${T(COMMON.area)}:</span> ${area}</div><div><span>${T(COMMON.inspector)}:</span> ${s.inspector ? L(s.inspector) : "—"}</div>
<div><span>${T(COMMON.datetime)}:</span> ${ltr(`${s.date} ${s.time}`)}</div><div><span>${T(STR.approvedBy)}:</span> ${L(s.approvedBy.name)}</div>
</div>
${overview}
${parts.map(renderPart).join("\n")}
<h2>${T(STR.decisions)}</h2><table><thead><tr><th>${T(STR.action)}</th><th>${T(STR.by)}</th><th class="c-when">${T(STR.when)}</th></tr></thead><tbody>${trail}</tbody></table>
${sign}
<div class="foot">${T(STR.issued)}: ${when(s.issuedAt)} · ${T(STR.immutable)}</div>
</body></html>`;
}
