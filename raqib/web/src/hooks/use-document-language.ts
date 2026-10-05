import { useEffect } from "react";
import { useI18n } from "./use-i18n";

/** Keep <html lang> and <html dir> in step with the interface language (Arabic is right-to-left). */
export function useDocumentLanguage(): void {
  const { i, lang } = useI18n();
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = i.dir;
  }, [lang, i.dir]);
}
