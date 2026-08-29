import { languageOf } from "./locale.js";

/**
 * The bilingual content model (§7.10). Any user-facing string stored by a
 * module that differs per language is a Translatable. AR is written first,
 * deliberately — AURIC is Arabic-first, not English translated.
 */
export interface Translatable<T = string> {
  ar: T;
  en: T;
  [locale: string]: T;
}

export function translatable<T>(ar: T, en: T, extra?: Record<string, T>): Translatable<T> {
  return { ar, en, ...extra };
}

/** Resolve a Translatable for a locale, falling back AR → EN → first value. */
export function resolveTranslatable<T>(value: Translatable<T>, locale: string): T {
  const lang = languageOf(locale);
  if (value[lang] !== undefined) return value[lang] as T;
  if (value.ar !== undefined) return value.ar;
  if (value.en !== undefined) return value.en;
  const first = Object.values(value)[0];
  return first as T;
}

export function isTranslatable(value: unknown): value is Translatable {
  return (
    typeof value === "object" &&
    value !== null &&
    "ar" in value &&
    "en" in value &&
    typeof (value as Record<string, unknown>).ar === "string"
  );
}
