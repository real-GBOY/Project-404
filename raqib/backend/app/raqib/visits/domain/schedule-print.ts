import type { L10n } from "@raqib/raqib/shared/l10n.js";
import { COMMON, brandBar, esc, ltr, printCss, type Lang } from "@raqib/raqib/reports/domain/print-kit.js";

/** One visit as the schedule documents show it. */
export interface ScheduleRow {
  ref: string;
  date: string;
  time: string;
  project: L10n;
  site: L10n;
  area: L10n | string | null;
  inspector: L10n | null;
  shift: L10n | string;
  type: string;
  status: string;
  forms: string[];
}

const STR = {
  title: { ar: "جدول الزيارات", en: "Visit schedule" },
  period: { ar: "الفترة", en: "Period" },
  unassigned: { ar: "غير مسندة", en: "Unassigned" },
  ref: { ar: "الزيارة", en: "Visit" },
  time: { ar: "الوقت", en: "Time" },
  forms: { ar: "النماذج", en: "Forms" },
  status: { ar: "الحالة", en: "Status" },
  type: { ar: "النوع", en: "Type" },
  total: { ar: "عدد الزيارات", en: "Visits" },
  types: {
    routine: { ar: "دورية", en: "Routine" },
    surprise: { ar: "مفاجئة", en: "Surprise" },
    follow: { ar: "متابعة", en: "Follow-up" },
    night: { ar: "ليلية", en: "Night" },
  } as Record<string, L10n>,
  statuses: {
    scheduled: { ar: "مجدولة", en: "Scheduled" },
    assigned: { ar: "مسندة", en: "Assigned" },
    in_progress: { ar: "قيد التنفيذ", en: "In progress" },
    pending_review: { ar: "بانتظار المراجعة", en: "Pending review" },
    pending_approval: { ar: "بانتظار الاعتماد", en: "Pending approval" },
    returned: { ar: "معادة", en: "Returned" },
    approved: { ar: "معتمدة", en: "Approved" },
    rejected: { ar: "مرفوضة", en: "Rejected" },
    cancelled: { ar: "ملغاة", en: "Cancelled" },
    overdue: { ar: "متأخرة", en: "Overdue" },
  } as Record<string, L10n>,
};

/** "14:30" as a 12-hour clock time (2:30 PM / 2:30 م), Western digits. */
export function time12(hhmm: string, lang: Lang): string {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  const h = Number(m[1]);
  const suffix = h >= 12 ? (lang === "ar" ? "م" : "PM") : lang === "ar" ? "ص" : "AM";
  return `${h % 12 || 12}:${m[2]} ${suffix}`;
}

const text = (x: L10n | string | null, lang: Lang): string => (x == null ? "" : typeof x === "string" ? x : x[lang]);

/** The schedule as a CSV (UTF-8 with BOM so Excel keeps the Arabic), one row per visit. */
export function scheduleCsv(rows: ScheduleRow[], lang: Lang, field: (v: unknown) => string): string {
  const head = ["Visit", "Date", "Time", "Project", "Site", "Area", "Inspector", "Shift", "Type", "Status", "Forms"];
  const lines = rows.map((r) => [
    r.ref,
    r.date,
    time12(r.time, "en"),
    text(r.project, lang),
    text(r.site, lang),
    text(r.area, lang),
    r.inspector ? text(r.inspector, lang) : "",
    text(r.shift, lang),
    (STR.types[r.type] ?? { ar: r.type, en: r.type })[lang],
    (STR.statuses[r.status] ?? { ar: r.status, en: r.status })[lang],
    r.forms.join(" · "),
  ]);
  return `${String.fromCharCode(0xfeff)}${[head, ...lines].map((l) => l.map(field).join(",")).join("\r\n")}\r\n`;
}

/**
 * The schedule as an A4 page (landscape), grouped by inspector then date, so each inspector's own schedule can be printed
 * on its own page. The browser saves it as PDF.
 */
export function renderScheduleHtml(rows: ScheduleRow[], range: { from: string; to: string }, lang: Lang, orgName: string, logo: string | null = null): string {
  const T = (k: L10n): string => k[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";
  const groups = new Map<string, { name: string; rows: ScheduleRow[] }>();
  for (const r of rows) {
    const key = r.inspector?.en ?? "";
    const g = groups.get(key) ?? { name: r.inspector ? r.inspector[lang] : T(STR.unassigned), rows: [] };
    g.rows.push(r);
    groups.set(key, g);
  }
  const body = [...groups.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((g) => {
      const trs = g.rows
        .slice()
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
        .map(
          (r) =>
            `<tr><td class="c-id">${ltr(r.ref)}</td><td class="c-id">${ltr(r.date)}</td><td class="c-id">${ltr(time12(r.time, lang))}</td><td>${esc(text(r.project, lang))} · ${esc(text(r.site, lang))}${r.area ? ` · ${esc(text(r.area, lang))}` : ""}</td><td>${esc(text(r.shift, lang))}</td><td>${esc((STR.types[r.type] ?? { ar: r.type, en: r.type })[lang])}</td><td>${esc((STR.statuses[r.status] ?? { ar: r.status, en: r.status })[lang])}</td><td>${r.forms.map((f) => ltr(f)).join(" · ")}</td></tr>`,
        )
        .join("");
      return `<section class="form-part"><h2>${esc(g.name)} · ${T(STR.total)}: ${g.rows.length}</h2><table><thead><tr><th class="c-id">${T(STR.ref)}</th><th class="c-id">${T(COMMON.date)}</th><th class="c-id">${T(STR.time)}</th><th>${T(COMMON.project)} · ${T(COMMON.site)}</th><th>${T(COMMON.shift)}</th><th>${T(STR.type)}</th><th>${T(STR.status)}</th><th>${T(STR.forms)}</th></tr></thead><tbody>${trs}</tbody></table></section>`;
    })
    .join("");
  const css = printCss(lang, `${T(STR.title)} ${range.from} → ${range.to}`).replace("size: A4;", "size: A4 landscape;");
  return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><title>${esc(T(STR.title))} ${esc(range.from)}</title><style>${css} .multi .form-part { break-before: page; }</style></head><body class="multi">
${brandBar(orgName, logo)}
<div class="head"><div><h1>${T(STR.title)}</h1></div><div class="score" style="font-size:12px">${T(STR.period)}<br>${ltr(`${range.from} → ${range.to}`)}</div></div>
${body || `<p>—</p>`}
</body></html>`;
}
