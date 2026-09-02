import { i18n } from "@/lib/i18n";
import type { Money } from "@/types/api";

/**
 * Locale-aware formatting — mirrors `core/localization/formatters`.
 * Egypt-first: `ar-EG` / `en-EG`, `Africa/Cairo`, EGP default currency.
 */
const REGION = "EG";
const TZ = "Africa/Cairo";

function intlLocale(): string {
  const lang = (i18n.resolvedLanguage ?? "ar").split("-")[0];
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

export function formatPercent(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat(intlLocale(), {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}
