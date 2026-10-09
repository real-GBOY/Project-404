import { useDocumentLanguage } from "@/hooks/use-document-language";
import { useI18n } from "@/hooks/use-i18n";
import { chooseLanguage } from "@/state/language";
import { C } from "@/styles/colors";
import { FONT } from "@/styles/typography";
import { Capabilities } from "./capabilities";
import { Footer, Header } from "./chrome";
import { Bilingual, Cta, Records, Roles } from "./closing";
import { AR } from "./copy-ar";
import { EN } from "./copy-en";
import { Hero, Problem } from "./intro";
import { How } from "./how";
import { Tour } from "./tour";
import { useLayout } from "./ui";

/**
 * The public marketing page, shown to anyone who is not signed in. Its language follows the interface language
 * (Arabic by default); every call to action leads to sign-in.
 */
export function LandingPage() {
  const { lang, i } = useI18n();
  useDocumentLanguage();
  const L = useLayout();
  const c = lang === "ar" ? AR : EN;
  return (
    <div
      dir={i.dir}
      lang={lang}
      style={{
        fontFamily: FONT.sans,
        color: C.text.ink,
        fontSize: 16,
        lineHeight: 1.6,
        background: C.surface.canvas,
        minHeight: "100vh",
        overflowX: "clip",
      }}
    >
      <Header c={c} L={L} lang={lang} onLang={chooseLanguage} />
      <main>
        <Hero c={c} L={L} />
        <Problem c={c} L={L} />
        <How c={c} L={L} />
        <Tour c={c} L={L} lang={lang} />
        <Capabilities c={c} L={L} />
        <Roles c={c} L={L} />
        <Records c={c} L={L} />
        <Bilingual c={c} L={L} />
        <Cta c={c} L={L} />
      </main>
      <Footer c={c} L={L} />
    </div>
  );
}
