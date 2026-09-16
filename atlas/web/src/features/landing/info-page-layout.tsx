import type { ReactNode } from "react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { LogoMark } from "@/components/ui/logo";
import { SiteFooter } from "./site-footer";
import { BODY_TEXT, GRAPHITE, HAIRLINE_DARK, INK, MUTED_TEXT, OCHRE_DEEP, PAPER } from "./landing-data";

/** Shared chrome for the small standalone marketing/legal pages (About,
 *  Careers, Contact, Privacy, Terms) — same header identity and the same
 *  `SiteFooter` as the landing page, so every footer link lands somewhere
 *  that actually looks like part of the site, not a bare page. */
export function InfoPageLayout({ title, eyebrow, children }: { title: string; eyebrow: string; children: ReactNode }) {
  useEffect(() => {
    document.title = `${title} — Atlas RE OS`;
  }, [title]);

  return (
    <div style={{ fontFamily: "Archivo, Helvetica, Arial, sans-serif", color: INK, background: PAPER, minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <style>{`.atlas-info a { color: ${OCHRE_DEEP}; }`}</style>
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: GRAPHITE, borderBottom: `1px solid ${HAIRLINE_DARK}` }}>
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "14px clamp(18px,4vw,48px)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0, textDecoration: "none" }}>
            <LogoMark size={28} tone="paper" />
            <div style={{ display: "flex", alignItems: "flex-end", gap: 7, color: PAPER, minWidth: 0 }}>
              <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-.03em", lineHeight: 1 }}>ATLAS</span>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: ".18em", color: MUTED_TEXT, whiteSpace: "nowrap" }}>RE OS</span>
            </div>
          </Link>
          <Link to="/" style={{ fontSize: 13, color: MUTED_TEXT, textDecoration: "none" }}>
            ← Back to Atlas
          </Link>
        </div>
      </header>

      <main className="atlas-info" style={{ flex: 1, padding: "clamp(48px,8vw,88px) clamp(18px,4vw,48px)" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: OCHRE_DEEP }}>{eyebrow}</div>
          <h1 style={{ margin: 0, fontSize: "clamp(28px,4vw,42px)", fontWeight: 600, letterSpacing: "-.03em", lineHeight: 1.1 }}>{title}</h1>
          <div style={{ display: "flex", flexDirection: "column", gap: 18, fontSize: 16, lineHeight: 1.65, color: BODY_TEXT, textWrap: "pretty" }}>{children}</div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
