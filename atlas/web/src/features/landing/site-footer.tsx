import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { LogoMark } from "@/components/ui/logo";
import { GRAPHITE_RAISED, HAIRLINE_DARK, MUTED_TEXT, PAPER, SECONDARY_TEXT } from "./landing-data";

const REPO_URL = "https://github.com/real-GBOY/Project-404";

/** A footer link that works from any page: same-page smooth-scroll when
 *  already on "/", a real navigation (which `LandingPage` then resolves via
 *  its own hash-scroll effect) from anywhere else. */
function SectionLink({ id, children }: { id: string; children: string }) {
  return (
    <Link to={`/#${id}`} style={{ color: "inherit", textDecoration: "none" }}>
      {children}
    </Link>
  );
}

const colStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 10, fontSize: 13 };
const headingStyle: CSSProperties = {
  fontFamily: "'IBM Plex Mono',monospace",
  fontSize: 9,
  letterSpacing: ".16em",
  textTransform: "uppercase",
  color: SECONDARY_TEXT,
};

/** The site-wide marketing footer — shared by the landing page and every
 *  standalone info page (About/Careers/Contact/Privacy/Terms), so there's one
 *  place that defines where each link actually goes.
 *
 *  Self-contained underline reset: the landing page's global `.atlas-landing a`
 *  rule draws its "link" look as a `border-bottom` (not `text-decoration`), so
 *  the inline `textDecoration: "none"` on every link below doesn't cancel it —
 *  these are footer nav items, meant to read as a plain list, not inline prose
 *  links. Scoped here so it holds regardless of which page's chrome wraps it. */
export function SiteFooter() {
  return (
    <footer className="atlas-footer" style={{ background: GRAPHITE_RAISED, color: MUTED_TEXT, padding: "clamp(36px,5vw,64px) clamp(18px,4vw,48px) 28px", borderTop: `1px solid ${HAIRLINE_DARK}` }}>
      <style>{`.atlas-footer a { border-bottom: none; text-decoration: none; }`}</style>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", flexDirection: "column", gap: 36 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 32 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: "34ch" }}>
            <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
              <LogoMark size={26} tone="paper" />
              <div style={{ display: "flex", alignItems: "flex-end", gap: 7, color: PAPER }}>
                <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-.03em", lineHeight: 1 }}>ATLAS</span>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: ".18em", whiteSpace: "nowrap" }}>RE OS</span>
              </div>
            </Link>
            <div style={{ fontSize: 14, lineHeight: 1.55 }}>The operating system for real estate companies — from the first lead to the final payment.</div>
          </div>
          <div style={colStyle}>
            <div style={headingStyle}>Product</div>
            <SectionLink id="domains">CRM &amp; Sales</SectionLink>
            <SectionLink id="inventory">Properties &amp; Inventory</SectionLink>
            <SectionLink id="finance">Finance &amp; Collections</SectionLink>
            <SectionLink id="domains">Operations</SectionLink>
            <SectionLink id="domains">Analytics</SectionLink>
            <SectionLink id="ai-copilot">AI Copilot</SectionLink>
          </div>
          <div style={colStyle}>
            <div style={headingStyle}>Platform</div>
            <a href={REPO_URL} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "none" }}>
              AURIC Core (source)
            </a>
            <SectionLink id="domains">Roles &amp; permissions</SectionLink>
            <SectionLink id="domains">Documents</SectionLink>
            <SectionLink id="domains">Notifications</SectionLink>
            <SectionLink id="domains">Audit trail</SectionLink>
          </div>
          <div style={colStyle}>
            <div style={headingStyle}>Company</div>
            <Link to="/about" style={{ color: "inherit", textDecoration: "none" }}>
              About
            </Link>
            <Link to="/careers" style={{ color: "inherit", textDecoration: "none" }}>
              Careers
            </Link>
            <Link to="/contact" style={{ color: "inherit", textDecoration: "none" }}>
              Contact
            </Link>
            <Link to="/login" style={{ color: "inherit", textDecoration: "none" }}>
              Request a Demo
            </Link>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap", borderTop: `1px solid ${HAIRLINE_DARK}`, paddingTop: 20, fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase" }}>
          <span>Atlas RE OS — An AURIC product</span>
          <span style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <Link to="/privacy" style={{ color: "inherit", textDecoration: "none" }}>
              Privacy
            </Link>
            <Link to="/terms" style={{ color: "inherit", textDecoration: "none" }}>
              Terms
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
