import { languageOf } from "../domain/locale.js";

/**
 * Locale-aware formatting (§7.10 / §12A). Egypt-first defaults: `ar-EG` /
 * `en-EG`, EGP currency, Africa/Cairo timezone. Hijri calendar output is
 * "Later" but the calendar option is already threaded through so adding it is
 * a one-line change.
 */
const REGION = "EG";
const DEFAULT_TZ = "Africa/Cairo";
const DEFAULT_CURRENCY = "EGP";

export type CalendarSystem = "gregory" | "islamic-umalqura";

export interface FormatOptions {
  timeZone?: string;
  calendar?: CalendarSystem;
}

function intlLocale(locale: string, calendar?: CalendarSystem): string {
  const lang = languageOf(locale);
  const base = `${lang}-${REGION}`;
  return calendar ? `${base}-u-ca-${calendar}` : base;
}

export function formatDate(
  value: Date | string | number,
  locale: string,
  opts: FormatOptions & Intl.DateTimeFormatOptions = {},
): string {
  const { timeZone, calendar, ...dtOpts } = opts;
  return new Intl.DateTimeFormat(intlLocale(locale, calendar), {
    dateStyle: "medium",
    timeZone: timeZone ?? DEFAULT_TZ,
    ...dtOpts,
  }).format(new Date(value));
}

export function formatDateTime(value: Date | string | number, locale: string, opts: FormatOptions = {}): string {
  return formatDate(value, locale, { dateStyle: "medium", timeStyle: "short", ...opts });
}

export function formatNumber(value: number, locale: string, opts: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat(intlLocale(locale), opts).format(value);
}

export function formatCurrency(
  value: number,
  locale: string,
  currency: string = DEFAULT_CURRENCY,
): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency,
  }).format(value);
}

export function formatPercent(value: number, locale: string, fractionDigits = 0): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export const formatDefaults = { region: REGION, timeZone: DEFAULT_TZ, currency: DEFAULT_CURRENCY };
