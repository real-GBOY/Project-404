import type { ReactNode } from "react";
import { useDocumentLanguage } from "@/hooks/use-document-language";
import { useI18n } from "@/hooks/use-i18n";
import { C } from "@/styles/colors";
import { FONT } from "@/styles/typography";
import { BrandMark } from "./BrandMark";
import { LanguageSwitch } from "./LanguageSwitch";

/**
 * The frame of every page shown outside the workspace (sign-in, password recovery, account security): the brand, the language
 * switch, and a centered column. The design has no dedicated screen for these, so they share this one layout.
 */
export function AuthLayout({
  children,
  wide,
  centered,
  tagline,
}: {
  children: ReactNode;
  wide?: boolean;
  centered?: boolean;
  tagline?: boolean;
}) {
  const { i, lang } = useI18n();
  useDocumentLanguage();
  return (
    <div
      dir={i.dir}
      lang={lang}
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: centered ? "center" : "flex-start",
        padding: 16,
        background: C.surface.canvas,
        fontFamily: FONT.sans,
        color: C.text.ink,
        fontSize: 14,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: wide ? 640 : 420,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          marginTop: centered ? 0 : "6vh",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <BrandMark letter={i.t.logoMark!} />
          <div style={{ lineHeight: 1.25 }}>
            <div style={{ fontSize: tagline ? 22 : 20, fontWeight: 600 }}>{i.t.brand}</div>
            {tagline ? (
              <div style={{ fontSize: 12.5, color: C.text.secondary }}>{i.t.signInSub}</div>
            ) : null}
          </div>
          <LanguageSwitch />
        </div>
        {children}
      </div>
    </div>
  );
}
