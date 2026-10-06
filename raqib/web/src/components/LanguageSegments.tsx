import type { Lang } from "@/api/types";
import { seg } from "@/styles/segmented";
import { C } from "@/styles/colors";
import { chooseLanguage } from "@/state/language";

/** The language switch in the dark presenter bar (same behavior as `LanguageSwitch`, dark-chrome colors). */
export function LanguageSegments({ lang }: { lang: Lang }) {
  return (
    <div
      style={{
        display: "flex",
        border: `1px solid ${C.chrome.line}`,
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      {(["ar", "en"] as const).map((l) => {
        const s = seg(lang, l, l === "ar" ? "العربية" : "English", () => chooseLanguage(l), true);
        return (
          <button
            key={l}
            onClick={s.set}
            style={{
              border: 0,
              padding: "0 10px",
              height: 26,
              fontSize: 12,
              cursor: "pointer",
              background: s.bg,
              color: s.fg,
            }}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
