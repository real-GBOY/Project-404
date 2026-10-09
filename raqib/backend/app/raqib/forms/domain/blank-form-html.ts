import type { L10n } from "@raqib/raqib/shared/l10n.js";
import { COMMON, brandBar, esc, ltr, printCss, type Lang } from "@raqib/raqib/reports/domain/print-kit.js";
import type { FormItem, FormSection } from "./form.js";

const STR = {
  title: { ar: "نموذج تفتيش فارغ", en: "Blank inspection form" },
  visitNo: { ar: "رقم الزيارة", en: "Visit no." },
  compliant: { ar: "مطابق", en: "Compliant" },
  nonCompliant: { ar: "غير مطابق", en: "Non-compliant" },
  na: { ar: "لا ينطبق", en: "N/A" },
  yes: { ar: "نعم", en: "Yes" },
  no: { ar: "لا", en: "No" },
  notes: { ar: "ملاحظات / أدلة", en: "Notes / evidence" },
  signInspector: { ar: "المفتش", en: "Inspector" },
  signReviewer: { ar: "مراجع الجودة", en: "Quality reviewer" },
  signApprover: { ar: "المعتمد", en: "Approver" },
  printedFrom: { ar: "نسخة فارغة للطباعة من نظام رقيب", en: "Blank copy printed from Raqib" },
};

const blank = '<span class="box"></span>';

function answerCell(it: FormItem, lang: Lang): string {
  const opt = (label: L10n): string => `${blank} ${esc(label[lang])}`;
  switch (it.type) {
    case "cnx":
      return [opt(STR.compliant), opt(STR.nonCompliant), ...(it.na ? [opt(STR.na)] : [])].join("<br>");
    case "yesno":
      return [opt(STR.yes), opt(STR.no), ...(it.na ? [opt(STR.na)] : [])].join("<br>");
    case "scale5":
      return [1, 2, 3, 4, 5].map((n) => `${blank} ${n}`).join(" ");
    default:
      return "&nbsp;"; // number, text, select, date: a free line to write on
  }
}

/**
 * A printable blank copy of one form version for use on paper: the form name, number and version, fields for the visit
 * details, every item in its original order with answer boxes and room for notes, and signature lines.
 */
export function renderBlankFormHtml(
  form: { code: string; name: L10n; version: string },
  sections: FormSection[],
  lang: Lang,
  brand?: { name: L10n; logo: string | null },
): string {
  const T = (k: L10n): string => k[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";
  const line = '<span style="display:inline-block;min-width:120px;border-bottom:1px solid #191c1f">&nbsp;</span>';
  const body = sections
    .map((sec, si) => {
      const rows = sec.items
        .map(
          (it, ii) =>
            `<tr><td class="c-num">${ltr(`${si + 1}.${ii + 1}`)}</td><td>${esc(it.text[lang])}</td><td class="c-ans" style="width:150px;font-weight:400">${answerCell(it, lang)}</td><td style="width:30%">&nbsp;</td></tr>`,
        )
        .join("");
      return `<h3>${si + 1}. ${esc(sec.title[lang])}</h3><table><thead><tr><th class="c-num">${T(COMMON.no)}</th><th>${T(COMMON.requirement)}</th><th style="width:150px">${T(COMMON.result)}</th><th>${T(STR.notes)}</th></tr></thead><tbody>${rows}</tbody></table>`;
    })
    .join("");
  return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><title>${esc(form.code)} v${esc(form.version)}</title><style>${printCss(lang, `${form.code} v${form.version}`)}</style></head><body>
${brand ? brandBar(brand.name[lang], brand.logo) : ""}
<div class="head"><div><h1>${esc(form.name[lang])}</h1><div>${ltr(form.code)} · ${T(COMMON.version)} ${ltr(form.version)}</div></div><div class="score" style="font-size:11px;color:#6b7280">${T(STR.title)}</div></div>
<div class="meta">
<div><span>${T(COMMON.project)}:</span> ${line}</div><div><span>${T(COMMON.site)}:</span> ${line}</div>
<div><span>${T(COMMON.area)}:</span> ${line}</div><div><span>${T(COMMON.inspector)}:</span> ${line}</div>
<div><span>${T(COMMON.datetime)}:</span> ${line}</div><div><span>${T(COMMON.shift)}:</span> ${line}</div>
<div><span>${T(STR.visitNo)}:</span> ${line}</div><div><span>${T(COMMON.issueNo)}:</span> ${line}</div>
</div>
${body}
<div class="sign"><div><b>${T(STR.signInspector)}</b>${T(COMMON.name)} / ${T(COMMON.signature)} / ${T(COMMON.date)}</div><div><b>${T(STR.signReviewer)}</b>${T(COMMON.name)} / ${T(COMMON.signature)} / ${T(COMMON.date)}</div><div><b>${T(STR.signApprover)}</b>${T(COMMON.name)} / ${T(COMMON.signature)} / ${T(COMMON.date)}</div></div>
<div class="foot">${T(STR.printedFrom)}</div>
</body></html>`;
}
