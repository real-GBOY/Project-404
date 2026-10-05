import type { Lang, L10n } from "@/api/types";
import { STRINGS_ADMIN } from "./strings.admin";
import { STRINGS_CORE } from "./strings.core";
import { STRINGS_QUALITY } from "./strings.quality";
import { STRINGS_ANALYTICS } from "./strings.analytics";
import { STRINGS_TRAINING } from "./strings.training";
import { STRINGS_REPORTS } from "./strings.reports";
import { STRINGS_SCREENS } from "./strings.screens";

type Table = Record<string, readonly [string, string]>;
const STR: Table = { ...STRINGS_ANALYTICS, ...STRINGS_TRAINING, ...STRINGS_CORE, ...STRINGS_ADMIN, ...STRINGS_SCREENS, ...STRINGS_REPORTS, ...STRINGS_QUALITY };

/** `{ar, en}` master data, or a plain user-entered string, as display text. User text is never translated. */
export type Localized = L10n | string | null | undefined;

export type DateStyle = "d" | "dy" | "full" | "dt" | "wd" | "dn" | "t" | "my";
const OPTS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  d: { day: "numeric", month: "short" },
  dy: { weekday: "long", day: "numeric", month: "long" },
  full: { day: "numeric", month: "long", year: "numeric" },
  dt: { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false },
  wd: { weekday: "short" },
  dn: { day: "numeric" },
  t: { hour: "2-digit", minute: "2-digit", hour12: false },
  my: { month: "long", year: "numeric" },
};

export interface I18n {
  lang: Lang;
  dir: "rtl" | "ltr";
  /** Every string for this language, keyed — what screens read as `t.xxx`. */
  t: Record<string, string>;
  /** Translate a key with `{placeholders}`; optionally force a language (reports). */
  S(key: string, vars?: Record<string, string | number>, lang?: Lang): string;
  /** Pick the display text of bilingual master data (falls back to the other language). */
  L(x: Localized, lang?: Lang): string;
  /** Locale-aware date/time. Western digits in both languages; Gregorian calendar. */
  fd(iso: string | null | undefined, style?: DateStyle, lang?: Lang): string;
  /** Whole days from a to b (ISO dates or timestamps). */
  days(a: string, b: string): number;
}

export function createI18n(lang: Lang): I18n {
  const idx = (l: Lang) => (l === "ar" ? 0 : 1);
  const t: Record<string, string> = {};
  for (const k in STR) t[k] = STR[k]![idx(lang)];

  const S: I18n["S"] = (key, vars, l = lang) => {
    const e = STR[key];
    let s = e ? e[idx(l)] : key;
    if (vars) for (const [n, v] of Object.entries(vars)) s = s.split(`{${n}}`).join(String(v));
    return s;
  };
  const L: I18n["L"] = (x, l = lang) => {
    if (x == null) return "";
    if (typeof x === "string") return x;
    return x[l] || x.en || x.ar || "";
  };
  const fd: I18n["fd"] = (iso, style = "d", l = lang) => {
    if (!iso) return "—";
    const d = new Date(iso.length === 10 ? `${iso}T00:00` : iso);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat(l === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", OPTS[style]).format(d);
  };
  const days: I18n["days"] = (a, b) =>
    Math.round((new Date(`${b.slice(0, 10)}T00:00`).getTime() - new Date(`${a.slice(0, 10)}T00:00`).getTime()) / 864e5);

  return { lang, dir: lang === "ar" ? "rtl" : "ltr", t, S, L, fd, days };
}

const KEY = "raqib.lang";
export function loadLang(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "ar" || v === "en") return v;
  } catch {
    /* storage unavailable — default */
  }
  return "ar";
}
export function saveLang(lang: Lang): void {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* ignore */
  }
}
