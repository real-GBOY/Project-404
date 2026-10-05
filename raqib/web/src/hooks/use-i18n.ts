import { useMemo } from "react";
import { createI18n, type I18n } from "@/i18n/i18n";
import { useUi } from "@/state/ui-store";
import type { Lang } from "@/api/types";

/** The translator for the interface language the person chose (re-created only when the language changes). */
export function useI18n(): { i: I18n; lang: Lang } {
  const { lang } = useUi();
  const i = useMemo(() => createI18n(lang), [lang]);
  return { i, lang };
}
