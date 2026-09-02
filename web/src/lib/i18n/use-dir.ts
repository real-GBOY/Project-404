import { useTranslation } from "react-i18next";
import { dirFor, type Locale } from "./index";

/** The active locale + writing direction. */
export function useDir(): { locale: Locale; dir: "rtl" | "ltr"; isRtl: boolean } {
  const { i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? "ar") as Locale;
  const dir = dirFor(locale);
  return { locale, dir, isRtl: dir === "rtl" };
}
