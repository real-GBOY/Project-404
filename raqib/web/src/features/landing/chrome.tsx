import { useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { C } from "@/styles/colors";
import type { Lang } from "@/api/types";
import type { Copy } from "./copy-types";
import type { Layout } from "./ui";

/** The in-page sections the navigation points at, in the order of `Copy.nav`. */
export const NAV_IDS = ["platform", "how", "tour", "capabilities", "roles", "contact"] as const;

/** Every call to action ends at sign-in: the demo accounts are listed there when the system runs in demo mode. */
export const CTA_TO = "/login";

export function goTo(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (id === "platform") window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  else el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

const plainButton: CSSProperties = {
  background: "none",
  border: 0,
  padding: 0,
  cursor: "pointer",
  font: "inherit",
};

export function Mark({
  size,
  letter,
  fontSize,
}: {
  size: number;
  letter: string;
  fontSize: number;
}) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        background: C.brand.primary,
        borderRadius: 4,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: C.surface.white,
        fontWeight: 700,
        fontSize,
      }}
    >
      {letter}
    </span>
  );
}

export function PrimaryLink({
  to,
  children,
  height = 50,
  size = 16,
}: {
  to: string;
  children: string;
  height?: number;
  size?: number;
}) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      to={to}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height,
        padding: "0 24px",
        borderRadius: 4,
        background: hover ? C.brand.primaryDark : C.brand.primary,
        color: C.surface.white,
        fontWeight: 500,
        fontSize: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        textDecoration: "none",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {children}
    </Link>
  );
}

export function Header({
  c,
  L,
  lang,
  onLang,
}: {
  c: Copy;
  L: Layout;
  lang: Lang;
  onLang: (l: Lang) => void;
}) {
  const [menu, setMenu] = useState(false);
  const go = (id: string) => {
    setMenu(false);
    goTo(id);
  };
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: C.surface.canvas,
        borderBottom: `1px solid ${C.border.hairline}`,
      }}
    >
      <div
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          padding: `0 ${L.hpad}px`,
          height: 64,
          display: "flex",
          alignItems: "center",
          gap: 24,
        }}
      >
        <button
          type="button"
          onClick={() => go("platform")}
          style={{
            ...plainButton,
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: C.text.ink,
          }}
        >
          <Mark size={32} letter="ر" fontSize={16} />
          <span style={{ lineHeight: 1.1, textAlign: "start" }}>
            <span style={{ display: "block", fontWeight: 700, fontSize: 17 }}>{c.brand}</span>
            <span style={{ display: "block", fontSize: 11, color: C.text.secondary }}>
              {c.brandSub}
            </span>
          </span>
        </button>
        {!L.navCollapse ? (
          <nav aria-label={c.footNav} style={{ display: "flex", gap: 4, marginInlineStart: 12 }}>
            {c.nav.map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => go(NAV_IDS[i]!)}
                style={{
                  ...plainButton,
                  height: 36,
                  padding: "0 12px",
                  borderRadius: 4,
                  fontSize: 14,
                  color: C.text.body,
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </button>
            ))}
          </nav>
        ) : null}
        <span style={{ flex: 1 }} />
        <div
          style={{
            display: "flex",
            border: `1px solid ${C.border.input}`,
            borderRadius: 4,
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {(
            [
              ["en", "EN"],
              ["ar", "ع"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={lang === k}
              onClick={() => onLang(k)}
              style={{
                border: 0,
                height: 34,
                padding: "0 10px",
                fontSize: 13,
                cursor: "pointer",
                background: lang === k ? C.text.ink : C.surface.white,
                color: lang === k ? C.surface.white : C.text.body,
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {!L.navCollapse ? (
          <>
            <Link
              to={CTA_TO}
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: C.text.ink,
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              {c.signIn}
            </Link>
            <PrimaryLink to={CTA_TO} height={40} size={14}>
              {c.tryDemo}
            </PrimaryLink>
          </>
        ) : (
          <button
            type="button"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
            style={{
              height: 40,
              minWidth: 44,
              border: `1px solid ${C.border.input}`,
              borderRadius: 4,
              background: C.surface.white,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {c.menu}
          </button>
        )}
      </div>
      {L.navCollapse && menu ? (
        <div
          style={{
            borderTop: `1px solid ${C.border.hairline}`,
            background: C.surface.white,
            padding: `8px ${L.hpad}px 16px`,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {c.nav.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => go(NAV_IDS[i]!)}
              style={{
                ...plainButton,
                height: 48,
                textAlign: "start",
                fontSize: 16,
                borderBottom: `1px solid ${C.surface.subtle}`,
                color: C.text.ink,
              }}
            >
              {label}
            </button>
          ))}
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <Link
              to={CTA_TO}
              style={{
                flex: 1,
                height: 50,
                border: `1px solid ${C.text.ink}`,
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: C.text.ink,
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              {c.signIn}
            </Link>
            <div style={{ flex: 1, display: "flex" }}>
              <PrimaryLink to={CTA_TO}>{c.tryDemo}</PrimaryLink>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

export function Footer({ c, L }: { c: Copy; L: Layout }) {
  return (
    <footer style={{ background: C.surface.canvas, borderTop: `1px solid ${C.border.hairline}` }}>
      <div
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          padding: `40px ${L.hpad}px 28px`,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))",
          gap: 28,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Mark size={30} letter="ر" fontSize={15} />
            <span style={{ fontWeight: 700, fontSize: 16 }}>Raqib · رقيب</span>
          </div>
          <p style={{ margin: 0, fontSize: 13.5, color: C.text.secondary, maxWidth: 300 }}>
            {c.footDesc}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, color: C.text.muted }}>{c.footNav}</div>
          {c.nav.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => goTo(NAV_IDS[i]!)}
              style={{ ...plainButton, textAlign: "start", fontSize: 14, color: C.text.ink }}
            >
              {label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Link to={CTA_TO} style={{ fontSize: 14, color: C.brand.primary, fontWeight: 500 }}>
            {c.signIn}
          </Link>
          <Link to={CTA_TO} style={{ fontSize: 14, color: C.brand.primary, fontWeight: 500 }}>
            {c.tryDemo}
          </Link>
        </div>
      </div>
      <div
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          padding: `14px ${L.hpad}px 28px`,
          borderTop: `1px solid ${C.border.hairline}`,
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
          fontSize: 12.5,
          color: C.text.secondary,
        }}
      >
        <span>{c.byAuric}</span>
        <span>© 2026 AURIC</span>
      </div>
    </footer>
  );
}
