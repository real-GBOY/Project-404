import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./resources/en.json";
import ar from "./resources/ar.json";

export const SUPPORTED_LOCALES = ["ar", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
/** The system default. A visitor gets English until they pick a language
 *  themselves (persisted to localStorage) — the browser/OS locale does not
 *  switch it. */
export const DEFAULT_LOCALE: Locale = "en";
export const RTL_LOCALES = new Set<Locale>(["ar"]);

export function dirFor(locale: string): "rtl" | "ltr" {
  return RTL_LOCALES.has(locale as Locale) ? "rtl" : "ltr";
}

/** Keep <html lang/dir> in sync with the active language. */
function applyDocumentLocale(locale: string): void {
  const root = document.documentElement;
  root.lang = locale;
  root.dir = dirFor(locale);
}

export async function initI18n(): Promise<typeof i18n> {
  await i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: { en, ar },
      fallbackLng: DEFAULT_LOCALE,
      supportedLngs: SUPPORTED_LOCALES as unknown as string[],
      defaultNS: "common",
      ns: [
        "common",
        "auth",
        "dashboard",
        "clients",
        "matters",
        "hearings",
        "tasks",
        "documents",
        "calendar",
        "billing",
        "team",
        "notifications",
        "settings",
      ],
      interpolation: { escapeValue: false },
      detection: {
        // No `navigator` — the browser/OS locale must not override the English
        // default. Only an explicit switch (cached to localStorage) does.
        order: ["localStorage", "htmlTag"],
        lookupLocalStorage: "mizan.locale",
        caches: ["localStorage"],
      },
    });

  applyDocumentLocale(i18n.resolvedLanguage ?? DEFAULT_LOCALE);
  i18n.on("languageChanged", applyDocumentLocale);
  return i18n;
}

export { i18n };
