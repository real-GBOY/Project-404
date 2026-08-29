import ar from "./ar.json";
import en from "./en.json";
import { languageOf } from "../domain/locale.js";

type Bundle = Record<string, unknown>;

const BUNDLES: Record<string, Bundle> = { ar, en };

function lookup(bundle: Bundle, path: string): string | undefined {
  const value = path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, bundle);
  return typeof value === "string" ? value : undefined;
}

function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) =>
    key in params ? String(params[key]) : `{{${key}}}`,
  );
}

/**
 * Translate a key for a locale. Falls back to the other bundled language,
 * then returns the key itself so a missing string is visible, not silent.
 */
export function t(key: string, locale: string, params: Record<string, string | number> = {}): string {
  const lang = languageOf(locale);
  const primary = BUNDLES[lang] ?? BUNDLES.ar;
  const found = lookup(primary!, key) ?? lookup(BUNDLES.en!, key) ?? lookup(BUNDLES.ar!, key);
  return found ? interpolate(found, params) : key;
}

/** All keys available (for a client-side i18n bootstrap payload). */
export function bundleFor(locale: string): Bundle {
  const lang = languageOf(locale);
  return BUNDLES[lang] ?? BUNDLES.ar!;
}
