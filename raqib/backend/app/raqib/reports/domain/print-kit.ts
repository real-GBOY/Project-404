import type { L10n } from "@raqib/raqib/shared/l10n.js";

/**
 * Shared pieces of every printable page (completed reports, blank forms): escaping, the A4 print stylesheet and the
 * wording they have in common. The browser lays the page out and saves it as PDF, which gives correct Arabic shaping and
 * right-to-left order; fonts used are embedded by the browser.
 */
export type Lang = "ar" | "en";

export const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Numbers, codes and dates keep left-to-right order inside right-to-left text, so "2026-10-08 09:30" never reads backwards. */
export const ltr = (s: unknown): string => `<bdi dir="ltr">${esc(s)}</bdi>`;

export const COMMON = {
  page: { ar: "صفحة", en: "Page" },
  of: { ar: "من", en: "of" },
  no: { ar: "الرقم", en: "No." },
  requirement: { ar: "البند", en: "Requirement" },
  result: { ar: "النتيجة", en: "Result" },
  weight: { ar: "الوزن", en: "Weight" },
  note: { ar: "ملاحظة", en: "Note" },
  project: { ar: "المشروع", en: "Project" },
  site: { ar: "الموقع", en: "Site" },
  area: { ar: "المنطقة", en: "Area" },
  inspector: { ar: "المفتش", en: "Inspector" },
  datetime: { ar: "التاريخ والوقت", en: "Date and time" },
  shift: { ar: "الوردية", en: "Shift" },
  form: { ar: "النموذج", en: "Form" },
  version: { ar: "الإصدار", en: "Version" },
  issueNo: { ar: "رقم الفحص", en: "Inspection no." },
  signature: { ar: "التوقيع", en: "Signature" },
  date: { ar: "التاريخ", en: "Date" },
  name: { ar: "الاسم", en: "Name" },
} satisfies Record<string, L10n>;

/** The organization's name (and logo, once supplied) at the top of a printed document. */
export function brandBar(name: string, logo: string | null): string {
  return `<div class="brand">${logo ? `<img src="${logo}" alt="">` : ""}<span>${esc(name)}</span></div>`;
}

/** The A4 stylesheet. Tables repeat their heading row on every page and never split a row; long text wraps instead of overflowing. */
export function printCss(lang: Lang, footerLabel: string): string {
  const pageWord = COMMON.page[lang];
  const ofWord = COMMON.of[lang];
  return `
@page { size: A4; margin: 16mm 14mm 18mm; @bottom-center { content: "${esc(footerLabel)} · ${pageWord} " counter(page) " ${ofWord} " counter(pages); font: 9px "Segoe UI", Tahoma, Arial, sans-serif; color: #6b7280; } }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: "Segoe UI", "Noto Naskh Arabic", "Noto Sans Arabic", Tahoma, Arial, sans-serif; color: #191c1f; font-size: 11px; line-height: 1.55; margin: 0; overflow-wrap: anywhere; word-break: normal; }
h1 { font-size: 21px; margin: 0 0 2px; } h2 { font-size: 14px; margin: 16px 0 6px; border-bottom: 1px solid #d7d4cc; padding-bottom: 3px; break-after: avoid; } h3 { font-size: 12px; margin: 12px 0 4px; break-after: avoid; }
.brand { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 12px; color: #4b5563; margin-bottom: 6px; } .brand img { max-height: 34px; max-width: 120px; }
.head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; border-bottom: 2px solid #0f5c4a; padding-bottom: 8px; margin-bottom: 10px; }
.score { text-align: center; min-width: 78px; } .score b { font-size: 28px; display: block; line-height: 1; }
.meta { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 18px; margin: 8px 0; } .meta div span { color: #6b7280; }
.stats { display: flex; flex-wrap: wrap; gap: 10px; margin: 8px 0; } .stats div { border: 1px solid #d7d4cc; border-radius: 6px; padding: 3px 10px; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead { display: table-header-group; } tfoot { display: table-footer-group; }
th { text-align: start; background: #f1efe9; color: #4b5563; font-weight: 600; font-size: 10px; padding: 4px 6px; border-bottom: 1px solid #d7d4cc; }
td { border-bottom: 1px solid #ebe9e3; padding: 4px 6px; vertical-align: top; }
tr { break-inside: avoid; page-break-inside: avoid; }
.c-num { width: 46px; color: #6b7280; } .c-id { width: 92px; color: #6b7280; } .c-ans { width: 104px; font-weight: 600; } .c-w { width: 58px; color: #6b7280; text-align: center; } .c-when { width: 130px; color: #6b7280; direction: ltr; text-align: start; } .c-box { width: 28px; text-align: center; }
.note { color: #4b5563; margin-top: 2px; } .chip { display: inline-block; background: #f1efe9; border-radius: 4px; padding: 0 6px; margin: 2px 2px 0 0; }
.imgs img { max-height: 70px; max-width: 120px; margin: 3px 3px 0 0; border: 1px solid #d7d4cc; border-radius: 3px; }
.multi .form-part { break-before: page; }
.sign { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 26px; break-inside: avoid; }
.sign div { border-top: 1px solid #191c1f; padding-top: 4px; min-height: 52px; font-size: 10px; color: #4b5563; }
.sign b { display: block; color: #191c1f; font-size: 11px; }
.foot { margin-top: 18px; color: #6b7280; font-size: 10px; border-top: 1px solid #d7d4cc; padding-top: 6px; }
.box { display: inline-block; width: 12px; height: 12px; border: 1.2px solid #191c1f; border-radius: 2px; vertical-align: middle; }
`;
}
