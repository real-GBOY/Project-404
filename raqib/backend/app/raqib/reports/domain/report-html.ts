import type { L10n } from "@raqib/raqib/shared/l10n.js";
import type { ReportSnapshot } from "./report-snapshot.js";

export type Lang = "ar" | "en";

const STR = {
  title: { ar: "تقرير تفتيش", en: "Inspection report" },
  ref: { ar: "رقم التقرير", en: "Report no." },
  visit: { ar: "رقم الزيارة", en: "Visit no." },
  project: { ar: "المشروع", en: "Project" },
  site: { ar: "الموقع", en: "Site" },
  area: { ar: "المنطقة", en: "Area" },
  inspector: { ar: "المفتش", en: "Inspector" },
  datetime: { ar: "التاريخ والوقت", en: "Date and time" },
  form: { ar: "النموذج", en: "Form" },
  score: { ar: "النتيجة", en: "Score" },
  compliant: { ar: "مطابق", en: "Compliant" },
  nonCompliant: { ar: "غير مطابق", en: "Non-compliant" },
  na: { ar: "لا ينطبق", en: "N/A" },
  evidence: { ar: "الأدلة", en: "Evidence" },
  note: { ar: "ملاحظة", en: "Note" },
  guards: { ar: "تقييم الحراس", en: "Guard evaluations" },
  decisions: { ar: "مسار القرارات", en: "Decision trail" },
  approvedBy: { ar: "اعتمد بواسطة", en: "Approved by" },
  issued: { ar: "أُصدر في", en: "Issued" },
  notAnswered: { ar: "—", en: "—" },
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

const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * The printable report, HTML for headless Chromium. Self-contained (no network): fonts are the system's, images are
 * inlined as data URIs by the caller. Arabic renders right-to-left; numbers keep Western digits so references match.
 */
export function renderReportHtml(s: ReportSnapshot, lang: Lang, images: Map<string, string>): string {
  const L = (x: L10n): string => esc(x[lang]);
  const T = (k: { ar: string; en: string }): string => k[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";
  const area = s.area == null ? "—" : typeof s.area === "string" ? esc(s.area) : L(s.area);
  const scoreColor = s.score.pct == null ? "#6b7280" : s.score.pct >= 90 ? "#1e6b45" : s.score.pct >= 75 ? "#8a5a00" : "#a3262a";
  const when = (iso: string): string => esc(new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC");

  const sections = s.sections
    .map((sec, si) => {
      const rows = sec.items
        .map((it) => {
          const ans = it.answer ? T(STR.answers[it.answer] ?? STR.notAnswered) : T(STR.notAnswered);
          const color = it.answer === "c" ? "#1e6b45" : it.answer === "n" ? "#a3262a" : "#6b7280";
          const imgs = it.evidence
            .filter((e) => e.kind === "photo" && images.has(e.id))
            .map((e) => `<img src="${images.get(e.id)}" alt="${esc(e.name)}">`)
            .join("");
          const other = it.evidence.filter((e) => !(e.kind === "photo" && images.has(e.id))).map((e) => `<span class="chip">${esc(e.name)}</span>`).join("");
          return `<tr class="item"><td class="num">${esc(it.num)}</td><td><div>${L(it.text)}</div>${it.note ? `<div class="note">${T(STR.note)}: ${esc(it.note)}</div>` : ""}${imgs ? `<div class="imgs">${imgs}</div>` : ""}${other ? `<div>${other}</div>` : ""}</td><td class="ans" style="color:${color}">${esc(ans)}</td><td class="w">${it.weight}</td></tr>`;
        })
        .join("");
      return `<h3>${si + 1}. ${L(sec.title)}</h3><table>${rows}</table>`;
    })
    .join("");

  const guards = s.guards.length
    ? `<h2>${T(STR.guards)}</h2><table>${s.guards.map((g) => `<tr><td class="num">${esc(g.employeeNo)}</td><td>${L(g.name)}${g.note ? `<div class="note">${esc(g.note)}</div>` : ""}</td><td class="ans">${g.pct == null ? "—" : g.pct + "%"}</td></tr>`).join("")}</table>`
    : "";

  const trail = s.decisions
    .map((d) => `<tr><td>${esc(T(STR.actions[d.action] ?? { ar: d.action, en: d.action }))}</td><td>${L(d.actor.name)} · ${L(d.actor.title)}</td><td class="when">${when(d.at)}</td></tr>${d.reason ? `<tr><td></td><td colspan="2" class="note">${esc(d.reason)}</td></tr>` : ""}`)
    .join("");

  return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><title>${esc(s.ref)}</title><style>
@page { size: A4; margin: 16mm 14mm; }
* { box-sizing: border-box; }
body { font-family: "Segoe UI", "Noto Naskh Arabic", "Noto Sans Arabic", Tahoma, Arial, sans-serif; color: #191c1f; font-size: 11px; line-height: 1.5; }
h1 { font-size: 22px; margin: 0 0 2px; } h2 { font-size: 14px; margin: 18px 0 6px; border-bottom: 1px solid #d7d4cc; padding-bottom: 3px; } h3 { font-size: 12px; margin: 12px 0 4px; }
.head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f5c4a; padding-bottom: 8px; margin-bottom: 10px; }
.score { text-align: center; } .score b { font-size: 30px; color: ${scoreColor}; display: block; line-height: 1; }
.meta { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 18px; margin: 8px 0; } .meta div span { color: #6b7280; }
.stats { display: flex; gap: 14px; margin: 8px 0; } .stats div { border: 1px solid #d7d4cc; border-radius: 6px; padding: 4px 10px; }
table { width: 100%; border-collapse: collapse; } td { border-bottom: 1px solid #ebe9e3; padding: 4px 6px; vertical-align: top; }
td.num { width: 52px; color: #6b7280; } td.ans { width: 90px; font-weight: 600; } td.w { width: 28px; color: #6b7280; text-align: center; } td.when { width: 140px; color: #6b7280; direction: ltr; }
.note { color: #4b5563; margin-top: 2px; } .chip { display: inline-block; background: #f1efe9; border-radius: 4px; padding: 0 6px; margin: 2px 2px 0 0; }
.imgs img { height: 70px; margin: 3px 3px 0 0; border: 1px solid #d7d4cc; border-radius: 3px; }
tr.item { page-break-inside: avoid; }
.foot { margin-top: 20px; color: #6b7280; font-size: 10px; border-top: 1px solid #d7d4cc; padding-top: 6px; }
</style></head><body>
<div class="head"><div><h1>${T(STR.title)}</h1><div>${esc(s.ref)}</div></div><div class="score"><b>${s.score.pct == null ? "—" : s.score.pct + "%"}</b>${T(STR.score)}</div></div>
<div class="meta">
<div><span>${T(STR.visit)}:</span> ${esc(s.visitRef)}</div><div><span>${T(STR.form)}:</span> ${esc(s.form.code)} · v${esc(s.form.version)}</div>
<div><span>${T(STR.project)}:</span> ${L(s.project.name)}</div><div><span>${T(STR.site)}:</span> ${L(s.site)}</div>
<div><span>${T(STR.area)}:</span> ${area}</div><div><span>${T(STR.inspector)}:</span> ${s.inspector ? L(s.inspector) : "—"}</div>
<div><span>${T(STR.datetime)}:</span> ${esc(s.date)} ${esc(s.time)}</div><div><span>${T(STR.approvedBy)}:</span> ${L(s.approvedBy.name)}</div>
</div>
<div class="stats"><div>${T(STR.compliant)}: <b>${s.score.compliant}</b></div><div>${T(STR.nonCompliant)}: <b>${s.score.nonCompliant}</b></div><div>${T(STR.na)}: <b>${s.score.na}</b></div><div>${T(STR.evidence)}: <b>${s.score.evidence}</b></div></div>
${sections}${guards}
<h2>${T(STR.decisions)}</h2><table>${trail}</table>
<div class="foot">${T(STR.issued)}: ${when(s.issuedAt)} · ${T(STR.immutable)}</div>
</body></html>`;
}
