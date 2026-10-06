import { chooseLanguage } from "@/state/language";
import { C } from "@/styles/colors";
import { useI18n } from "@/hooks/use-i18n";

const LANGS = [
  { code: "ar", label: "العربية" },
  { code: "en", label: "English" },
] as const;

/** The two-way language switch (Arabic / English) used on pages that render before anyone is signed in. */
export function LanguageSwitch() {
  const { lang } = useI18n();
  return (
    <div
      style={{
        marginInlineStart: "auto",
        display: "flex",
        border: `1px solid ${C.border.input}`,
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      {LANGS.map((l) => (
        <button
          key={l.code}
          onClick={() => chooseLanguage(l.code)}
          style={{
            border: 0,
            padding: "0 10px",
            height: 28,
            fontSize: 12,
            cursor: "pointer",
            background: lang === l.code ? C.text.ink : C.surface.white,
            color: lang === l.code ? C.surface.white : C.text.body,
          }}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

/** A single button pinned to the corner that flips the language, for the full-width public pages. */
export function FloatingLanguageToggle() {
  const { lang } = useI18n();
  return (
    <button
      onClick={() => chooseLanguage(lang === "ar" ? "en" : "ar")}
      style={{
        position: "fixed",
        top: 12,
        insetInlineEnd: 12,
        height: 34,
        padding: "0 12px",
        border: `1px solid ${C.border.input}`,
        borderRadius: 4,
        background: C.surface.white,
        cursor: "pointer",
        zIndex: 5,
      }}
    >
      {lang === "ar" ? "English" : "العربية"}
    </button>
  );
}
