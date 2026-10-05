import type { Lang } from "@/api/types";
import { saveLang } from "@/i18n/i18n";
import { setUi } from "./ui-store";

/** Switch the interface language: remembered on the device, and applied to every screen. */
export function chooseLanguage(lang: Lang): void {
  saveLang(lang);
  setUi({ lang });
}
