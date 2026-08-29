/**
 * Localization is ONLY about language, direction, and formatting (§7.10,
 * §12A). External systems and compliance (ETA e-invoicing, payment gateways)
 * are deliberately NOT here — they are adapters (§7.11).
 */
export type Direction = "rtl" | "ltr";

export const RTL_LANGUAGES = new Set(["ar", "he", "fa", "ur"]);

export function languageOf(locale: string): string {
  return locale.toLowerCase().split(/[-_]/)[0] ?? locale.toLowerCase();
}

export function directionOf(locale: string): Direction {
  return RTL_LANGUAGES.has(languageOf(locale)) ? "rtl" : "ltr";
}

export function isSupported(locale: string, supported: string[]): boolean {
  const lang = languageOf(locale);
  return supported.some((s) => languageOf(s) === lang);
}

/**
 * Pick the best supported locale from an ordered list of candidates
 * (query param, Accept-Language entries, user preference), falling back to
 * the configured default.
 */
export function negotiateLocale(
  candidates: Array<string | null | undefined>,
  supported: string[],
  fallback: string,
): string {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const lang = languageOf(candidate);
    const match = supported.find((s) => languageOf(s) === lang);
    if (match) return match;
  }
  return fallback;
}
