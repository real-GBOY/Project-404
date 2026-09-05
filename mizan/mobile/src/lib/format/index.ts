import { i18n } from "@/lib/i18n";
import type { Money } from "@/types/api";

/**
 * Locale-aware formatting — ported from mizan/web/src/lib/format/index.ts
 * (plain `Intl` APIs, no external date/number library). Egypt-first:
 * `ar-EG` / `en-EG`, `Africa/Cairo`, EGP default currency.
 */
const REGION = "EG";
const TZ = "Africa/Cairo";

function lang(): "ar" | "en" {
  return (i18n.resolvedLanguage ?? "en").split("-")[0] === "ar" ? "ar" : "en";
}

function intlLocale(): string {
  return `${lang()}-${REGION}`;
}

export function formatDate(
  value: Date | string | number,
  opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string {
  return new Intl.DateTimeFormat(intlLocale(), { timeZone: TZ, ...opts }).format(new Date(value));
}

export function formatDateTime(value: Date | string | number): string {
  return formatDate(value, { dateStyle: "medium", timeStyle: "short" });
}

export function formatTime(value: Date | string | number): string {
  return formatDate(value, { timeStyle: "short" });
}

export function formatNumber(value: number, opts: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat(intlLocale(), opts).format(value);
}

/** Format ONE currency amount. */
export function formatMoney({ currency, amount }: Money): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  return new Intl.NumberFormat(intlLocale(), {
    style: "currency",
    currency: currency || "EGP",
    maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(n);
}

/**
 * Format a list of per-currency amounts as separate strings. Never sums
 * across currencies (no FX). Render the result as stacked lines.
 */
export function formatMoneyList(amounts: Money[]): string[] {
  return amounts.map(formatMoney);
}

type RelativeUnit = "year" | "month" | "week" | "day" | "hour" | "minute";

/** English noun forms: [singular, plural]. */
const EN_UNIT: Record<RelativeUnit, [string, string]> = {
  year: ["year", "years"],
  month: ["month", "months"],
  week: ["week", "weeks"],
  day: ["day", "days"],
  hour: ["hour", "hours"],
  minute: ["minute", "minutes"],
};

const EN_DAY_IDIOM: Record<-1 | 0 | 1, string> = { [-1]: "yesterday", 0: "today", 1: "tomorrow" };
const AR_DAY_IDIOM: Record<-1 | 0 | 1, string> = { [-1]: "أمس", 0: "اليوم", 1: "غدًا" };

/** Arabic noun forms by CLDR plural category: [one, two, few (3-10), many/other (11+ and 0)]. */
const AR_UNIT: Record<RelativeUnit, [string, string, string, string]> = {
  year: ["سنة", "سنتين", "سنوات", "سنة"],
  month: ["شهر", "شهرين", "أشهر", "شهر"],
  week: ["أسبوع", "أسبوعين", "أسابيع", "أسبوع"],
  day: ["يوم", "يومين", "أيام", "يوم"],
  hour: ["ساعة", "ساعتين", "ساعات", "ساعة"],
  minute: ["دقيقة", "دقيقتين", "دقائق", "دقيقة"],
};

/** CLDR Arabic cardinal-plural category for a non-negative integer. */
function arPluralIndex(n: number): 0 | 1 | 2 | 3 {
  if (n === 1) return 0;
  if (n === 2) return 1;
  const mod100 = n % 100;
  if (mod100 >= 3 && mod100 <= 10) return 2;
  return 3; // 0, 11-99, 100+ — "many/other", singular accusative noun in MSA
}

/**
 * Relative time, e.g. "in 3 days" / "5h ago". Hand-rolled for this app's two
 * locales (`en`, `ar`) rather than `Intl.RelativeTimeFormat` — Hermes doesn't
 * implement it on every platform (and a `@formatjs` polyfill hit unrelated
 * Metro/Hermes module-resolution issues), so this avoids the whole class of
 * environment bugs. Only "day" gets the yesterday/today/tomorrow idiom (the
 * dominant real usage here — case deadlines); every other unit is numeric.
 */
export function formatRelative(value: Date | string | number): string {
  const diffMs = new Date(value).getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const units: [RelativeUnit, number][] = [
    ["year", 31_536_000_000],
    ["month", 2_592_000_000],
    ["week", 604_800_000],
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  const [unit, ms] = units.find(([, unitMs]) => abs >= unitMs) ?? units[units.length - 1];
  const count = Math.round(diffMs / ms);

  if (unit === "day" && count >= -1 && count <= 1) {
    return lang() === "ar" ? AR_DAY_IDIOM[count as -1 | 0 | 1] : EN_DAY_IDIOM[count as -1 | 0 | 1];
  }
  if (count === 0) return lang() === "ar" ? "الآن" : "now";

  const n = Math.abs(count);
  if (lang() === "ar") {
    const noun = AR_UNIT[unit][arPluralIndex(n)];
    // Arabic drops the numeral for 1/2 — the noun's singular/dual form already
    // carries the count ("منذ يومين", not "منذ 2 يومين").
    const withCount = n <= 2 ? noun : `${n} ${noun}`;
    return count < 0 ? `منذ ${withCount}` : `خلال ${withCount}`;
  }
  const [singular, plural] = EN_UNIT[unit];
  const noun = n === 1 ? singular : plural;
  return count < 0 ? `${n} ${noun} ago` : `in ${n} ${noun}`;
}

/** Human file size, e.g. "284 KB" / "1.2 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function formatPercent(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat(intlLocale(), {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}
