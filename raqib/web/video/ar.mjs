// English → Arabic lookup built from the app's own string tables, so the script never guesses a label.
import * as core from "../src/i18n/strings.core.ts";
import * as account from "../src/i18n/strings.account.ts";
import * as admin from "../src/i18n/strings.admin.ts";
import * as analytics from "../src/i18n/strings.analytics.ts";
import * as quality from "../src/i18n/strings.quality.ts";
import * as reports from "../src/i18n/strings.reports.ts";
import * as screens from "../src/i18n/strings.screens.ts";
import * as projects from "../src/i18n/strings.projects.ts";
import * as training from "../src/i18n/strings.training.ts";
const all = {};
for (const m of [core, account, admin, analytics, quality, reports, screens, projects, training])
  for (const tbl of Object.values(m)) if (tbl && typeof tbl === "object") Object.assign(all, tbl);
const byEn = new Map();
for (const [k, v] of Object.entries(all))
  if (Array.isArray(v) && v.length === 2) if (!byEn.has(v[1])) byEn.set(v[1], { ar: v[0], key: k });
export const ar = (en) => {
  const r = byEn.get(en);
  if (!r) throw new Error(`no Arabic for "${en}"`);
  return r.ar;
};
export const S = (key) => {
  const v = all[key];
  if (!v) throw new Error(`no key ${key}`);
  return v[0];
};
