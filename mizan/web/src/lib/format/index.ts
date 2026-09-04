import { i18n } from "@/lib/i18n";
import type { Money } from "@/types/api";

/**
 * Locale-aware formatting — mirrors `core/localization/formatters`.
 * Egypt-first: `ar-EG` / `en-EG`, `Africa/Cairo`, EGP default currency.
 */
const REGION = "EG";
const TZ = "Africa/Cairo";

function intlLocale(): string {
  const lang = (i18n.resolvedLanguage ?? "en").split("-")[0];
  return `${lang}-${REGION}`;
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
 * Format a list of per-currency amounts as separate strings. Never sums across
 * currencies (PLAN §6, no FX). Render the result as stacked lines.
 */
export function formatMoneyList(amounts: Money[]): string[] {
  return amounts.map(formatMoney);
}

/** Relative time, e.g. "in 3 days" / "5h ago". Uses `Intl.RelativeTimeFormat`. */
export function formatRelative(value: Date | string | number): string {
  const rtf = new Intl.RelativeTimeFormat(intlLocale(), { numeric: "auto" });
  const diffMs = new Date(value).getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000_000],
    ["month", 2_592_000_000],
    ["week", 604_800_000],
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === "minute") {
      return rtf.format(Math.round(diffMs / ms), unit);
    }
  }
  return rtf.format(0, "minute");
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
