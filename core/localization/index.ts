import type { onRequestHookHandler } from "fastify";
import type { AuricConfig } from "../kernel/config.js";
import { directionOf, negotiateLocale } from "./domain/locale.js";
import { localeHook } from "./middleware/locale-middleware.js";
import { t, bundleFor } from "./i18n/catalog.js";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
} from "./formatters/formatters.js";

export { directionOf, negotiateLocale, languageOf, isSupported } from "./domain/locale.js";
export { resolveTranslatable, translatable, type Translatable } from "./domain/translatable.js";
export {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
} from "./formatters/formatters.js";
export { t, bundleFor } from "./i18n/catalog.js";

export interface LocalizationModule {
  hook: onRequestHookHandler;
  t: typeof t;
  bundleFor: typeof bundleFor;
  format: {
    date: typeof formatDate;
    dateTime: typeof formatDateTime;
    number: typeof formatNumber;
    currency: typeof formatCurrency;
    percent: typeof formatPercent;
  };
  directionOf: typeof directionOf;
  supported: string[];
  default: string;
}

/**
 * Localization (§7.10) — the one deliberate upfront investment. Pure language,
 * direction, and formatting. Bilingual AR/EN, Arabic-first, AR-EG formatting.
 */
export function createLocalizationModule(config: AuricConfig): LocalizationModule {
  return {
    hook: localeHook({
      supported: config.supportedLocales,
      fallback: config.defaultLocale,
    }),
    t,
    bundleFor,
    format: {
      date: formatDate,
      dateTime: formatDateTime,
      number: formatNumber,
      currency: formatCurrency,
      percent: formatPercent,
    },
    directionOf,
    supported: config.supportedLocales,
    default: config.defaultLocale,
  };
}
