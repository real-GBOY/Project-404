import { I18nManager } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./resources/en";
import ar from "./resources/ar";

export const SUPPORTED_LOCALES = ["ar", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
/** The system default. A user gets English until they pick a language
 *  themselves (persisted to AsyncStorage) — the device locale does not
 *  switch it, mirroring mizan/web's deliberate choice. */
export const DEFAULT_LOCALE: Locale = "en";
export const RTL_LOCALES = new Set<Locale>(["ar"]);

const LOCALE_KEY = "mizan.locale";

export function dirFor(locale: string): "rtl" | "ltr" {
  return RTL_LOCALES.has(locale as Locale) ? "rtl" : "ltr";
}

async function readStoredLocale(): Promise<Locale> {
  try {
    const stored = await AsyncStorage.getItem(LOCALE_KEY);
    if (stored && (SUPPORTED_LOCALES as readonly string[]).includes(stored)) {
      return stored as Locale;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

export async function initI18n(): Promise<typeof i18n> {
  const initialLocale = await readStoredLocale();

  await i18n.use(initReactI18next).init({
    resources: { en, ar },
    lng: initialLocale,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES as unknown as string[],
    defaultNS: "common",
    ns: [
      "common",
      "auth",
      "dashboard",
      "notifications",
      "matters",
      "hearings",
      "tasks",
      "calendar",
      "clients",
      "documents",
      "billing",
      "assistant",
      "settings",
    ],
    interpolation: { escapeValue: false },
  });

  return i18n;
}

/**
 * Persist the choice, then apply RTL and switch the language. RN's own
 * layout engine (unlike a browser's `dir` attribute) only re-flows for RTL
 * on a native restart, so `I18nManager.forceRTL` here takes effect on the
 * *next* launch — the caller must prompt a reload (see `useLocaleSwitch`).
 */
export async function setLocale(locale: Locale): Promise<{ requiresRestart: boolean }> {
  const wasRtl = I18nManager.isRTL;
  const willBeRtl = dirFor(locale) === "rtl";
  try {
    await AsyncStorage.setItem(LOCALE_KEY, locale);
  } catch {
    /* ignore */
  }
  await i18n.changeLanguage(locale);
  if (wasRtl !== willBeRtl) {
    I18nManager.allowRTL(willBeRtl);
    I18nManager.forceRTL(willBeRtl);
    return { requiresRestart: true };
  }
  return { requiresRestart: false };
}

export { i18n };
