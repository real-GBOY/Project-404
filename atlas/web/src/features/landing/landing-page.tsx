import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LogoMark } from "@/components/ui/logo";
import {
  AI_ASKS,
  ANALYTICS_BAR_HEIGHTS,
  ANALYTICS_TAGS,
  ANSWERS,
  BODY_TEXT,
  COLLECTION_ROWS,
  CANVAS,
  CRM_TAGS,
  CYAN,
  CYAN_STRONG,
  DOMAINS,
  FAINT_TEXT,
  FIN_TAGS,
  FLOW_BUSINESS,
  FLOW_INTEL,
  FLOW_OPS,
  FOUNDATION,
  GRAPHITE,
  GRAPHITE_HOVER,
  GRAPHITE_RAISED,
  GREEN_STRONG,
  HAIRLINE,
  HAIRLINE_DARK,
  INK,
  LIFECYCLE_SOURCE,
  LINK_UNDERLINE,
  MUTED_TEXT,
  NATIVE_OBJECTS,
  OCHRE,
  OCHRE_DEEP,
  OCHRE_FOREGROUND,
  OPS_ITEMS,
  PAPER,
  PIPELINE_STAGES,
  PROBLEMS,
  RED,
  SECONDARY_TEXT,
  SURFACE,
  TEAMS,
  UNIT_FACTS,
  css,
  reveal,
  unitGrid,
} from "./landing-data";

const NAV_LINKS: [string, string][] = [
  ["platform", "Platform"],
  ["inventory", "Inventory"],
  ["finance", "Finance"],
  ["ai-copilot", "AI Copilot"],
];

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

const CTA_PRIMARY = css(`background:${OCHRE}; color:${OCHRE_FOREGROUND}; padding:14px 22px; font-size:14px; font-weight:600; white-space:nowrap; display:inline-block;`);
const CTA_GHOST = css(`border:1px solid ${SECONDARY_TEXT}; color:${PAPER}; padding:14px 22px; font-size:14px; white-space:nowrap; display:inline-block;`);
const EYEBROW = css(`font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.2em; text-transform:uppercase; color:${OCHRE_DEEP};`);
const H2 = css(`margin:0; font-size:clamp(27px,3.6vw,44px); font-weight:600; letter-spacing:-.03em; line-height:1.08; max-width:26ch;`);

/** Hamburger / close glyph for the mobile nav toggle — square caps, no rounded joins, matching the identity's iconography rule. */
function MenuGlyph({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 18 18" width={18} height={18} stroke={PAPER} strokeWidth={1.6} strokeLinecap="butt" aria-hidden="true">
      {open ? (
        <>
          <line x1={3} y1={3} x2={15} y2={15} />
          <line x1={15} y1={3} x2={3} y2={15} />
        </>
      ) : (
        <>
          <line x1={2} y1={5} x2={16} y2={5} />
          <line x1={2} y1={9} x2={16} y2={9} />
          <line x1={2} y1={13} x2={16} y2={13} />
        </>
      )}
    </svg>
  );
}

/** The section-10 mark: same plate/quadrant/datum as `LogoMark`, but each rect's fill animates as the lifecycle scroll-stepper advances. */
function LifecycleMark({ active }: { active: number }) {
  const lit = (i: number) => (active >= i ? PAPER : HAIRLINE_DARK);
  const fillStyle = css("transition:fill .4s cubic-bezier(.2,0,0,1);");
  return (
    <svg viewBox="0 0 64 64" width={168} height={168} style={{ display: "block", maxWidth: "60%" }} aria-hidden="true">
      <rect x={0} y={0} width={30} height={30} fill={lit(0)} style={fillStyle} />
      <rect x={34} y={34} width={30} height={30} fill={lit(1)} style={fillStyle} />
      <rect x={50} y={0} width={14} height={14} fill={lit(2)} style={fillStyle} />
      <rect x={34} y={16} width={14} height={14} fill={lit(3)} style={fillStyle} />
      <rect x={16} y={34} width={14} height={14} fill={lit(4)} style={fillStyle} />
      <rect x={0} y={50} width={14} height={14} fill={lit(5)} style={fillStyle} />
      <rect x={4} y={38} width={6} height={6} fill={OCHRE} />
    </svg>
  );
}

export function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const lifecycleRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.title = "Atlas RE OS — One operating system for your real estate business";
  }, []);

  // Close the mobile nav panel on Escape, or once the viewport is wide enough for
  // the full nav row (matches the `760px` breakpoint in the scoped <style> below).
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    const onResize = () => window.innerWidth > 760 && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [menuOpen]);

  // Reveal-on-scroll: sections already on screen at mount stay put; those below fade up.
  useEffect(() => {
    const show = (el: HTMLElement) => {
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    };
    const els = Array.from(rootRef.current?.querySelectorAll<HTMLElement>("[data-reveal]") ?? []);
    if (!els.length || typeof IntersectionObserver !== "function") {
      els.forEach(show);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            show(e.target as HTMLElement);
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
    const t = window.setTimeout(() => {
      els.forEach((el) => {
        if (el.getBoundingClientRect().top < window.innerHeight) show(el);
      });
    }, 120);
    return () => {
      io.disconnect();
      window.clearTimeout(t);
    };
  }, []);

  // Scroll-linked lifecycle stepper (section 10): the active stage tracks how far
  // that section has scrolled through the viewport, and the mark assembles with it.
  useEffect(() => {
    const onScroll = () => {
      const sec = lifecycleRef.current;
      if (!sec) return;
      const r = sec.getBoundingClientRect();
      const span = r.height - window.innerHeight * 0.55;
      const p = span > 0 ? Math.min(1, Math.max(0, (window.innerHeight * 0.45 - r.top) / span)) : 0;
      const a = Math.min(6, Math.max(0, Math.round(p * 6)));
      setActive((prev) => (prev === a ? prev : a));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const lifecycle = useMemo(
    () =>
      LIFECYCLE_SOURCE.map(([name, body], i) => ({
        n: String(i + 1).padStart(2, "0"),
        name,
        body,
        bg: i === active ? GRAPHITE : GRAPHITE_RAISED,
        fg: i === active ? OCHRE : PAPER,
        num: i === active ? OCHRE : SECONDARY_TEXT,
      })),
    [active],
  );

  const heroFloors = useMemo(() => unitGrid(6, 14, "dark"), []);
  const plateFloors = useMemo(() => unitGrid(10, 12, "light"), []);

  return (
    <div
      ref={rootRef}
      style={{
        fontFamily: "Archivo, Helvetica, Arial, sans-serif",
        color: INK,
        background: PAPER,
        overflowX: "hidden",
      }}
    >
      <style>{`
        .atlas-landing a { color: ${OCHRE_DEEP}; text-decoration: none; border-bottom: 1px solid ${LINK_UNDERLINE}; }
        .atlas-landing a:hover { color: ${OCHRE}; border-bottom-color: ${OCHRE}; }
        @keyframes atlasLandingPulse { 0%, 100% { opacity: 1; } 50% { opacity: .25; } }

        /* Header nav: full row on desktop, hamburger + dropdown panel on phones/tablets.
           The panel only ever exists in the DOM while open (React-gated); the media
           query is a second guard so it can never show at desktop widths either. */
        .atlas-nav-desktop { display: flex; align-items: center; gap: clamp(14px,2vw,26px); }
        .atlas-nav-toggle { display: none; }
        @media (max-width: 760px) {
          .atlas-nav-desktop { display: none; }
          .atlas-nav-toggle { display: inline-flex; }
        }
        @media (min-width: 761px) {
          .atlas-nav-panel { display: none !important; }
        }
      `}</style>

      <div className="atlas-landing">
        {/* ── Header ──────────────────────────────────────────── */}
        <header style={{ position: "sticky", top: 0, zIndex: 50, background: GRAPHITE, borderBottom: `1px solid ${HAIRLINE_DARK}` }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", padding: "14px clamp(18px,4vw,48px)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
              <LogoMark size={28} tone="paper" />
              <div style={{ display: "flex", alignItems: "flex-end", gap: 7, color: PAPER, minWidth: 0 }}>
                <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-.03em", lineHeight: 1 }}>ATLAS</span>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: ".18em", color: MUTED_TEXT, whiteSpace: "nowrap" }}>RE OS</span>
              </div>
            </div>

            <nav className="atlas-nav-desktop" aria-label="Primary" style={{ fontSize: 13, color: FAINT_TEXT }}>
              {NAV_LINKS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => scrollToId(id)}
                  style={{ whiteSpace: "nowrap", background: "none", border: "none", padding: 0, font: "inherit", color: "inherit", cursor: "pointer" }}
                >
                  {label}
                </button>
              ))}
              <Link to="/login" style={CTA_PRIMARY}>
                Request a Demo
              </Link>
            </nav>

            <button
              type="button"
              className="atlas-nav-toggle"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              style={{ alignItems: "center", justifyContent: "center", width: 38, height: 38, flex: "none", background: "none", border: `1px solid ${HAIRLINE_DARK}`, cursor: "pointer" }}
            >
              <MenuGlyph open={menuOpen} />
            </button>
          </div>

          {menuOpen && (
            <nav
              className="atlas-nav-panel"
              aria-label="Primary"
              style={{ display: "flex", flexDirection: "column", gap: 2, borderTop: `1px solid ${HAIRLINE_DARK}`, background: GRAPHITE, padding: "8px clamp(18px,4vw,48px) 18px" }}
            >
              {NAV_LINKS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    scrollToId(id);
                  }}
                  style={{ textAlign: "left", padding: "12px 0", background: "none", border: "none", borderBottom: `1px solid ${HAIRLINE_DARK}`, color: FAINT_TEXT, fontSize: 14, cursor: "pointer" }}
                >
                  {label}
                </button>
              ))}
              <Link to="/login" onClick={() => setMenuOpen(false)} style={{ ...CTA_PRIMARY, textAlign: "center", marginTop: 14 }}>
                Request a Demo
              </Link>
            </nav>
          )}
        </header>

        {/* ── Hero ────────────────────────────────────────────── */}
        <section style={{ background: GRAPHITE, color: PAPER, padding: "clamp(48px,8vw,116px) clamp(18px,4vw,48px) clamp(40px,6vw,80px)", position: "relative", overflow: "hidden" }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: "clamp(32px,5vw,64px)", alignItems: "center" }}>
            <div data-reveal="true" style={{ display: "flex", flexDirection: "column", gap: 26, ...reveal() }}>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: OCHRE }}>
                Real Estate Business Management Platform
              </div>
              <h1 style={{ margin: 0, fontSize: "clamp(34px,5.2vw,64px)", fontWeight: 600, letterSpacing: "-.035em", lineHeight: 1.02, textWrap: "balance" }}>
                One operating system for your entire real estate business.
              </h1>
              <p style={{ margin: 0, maxWidth: "54ch", fontSize: "clamp(16px,1.6vw,19px)", lineHeight: 1.55, color: FAINT_TEXT, textWrap: "pretty" }}>
                Atlas brings sales, properties, finance, operations, analytics and AI into one connected system — so every lead, unit, contract and installment lives in the same place, with the same numbers.
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <Link to="/login" style={CTA_PRIMARY}>
                  Request a Demo
                </Link>
                <Link to="/login" style={CTA_GHOST}>
                  Explore Atlas
                </Link>
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, letterSpacing: ".06em", color: MUTED_TEXT, borderTop: `1px solid ${HAIRLINE_DARK}`, paddingTop: 18 }}>
                From the first lead to the final payment. Everything connected.
              </div>
            </div>
            <div data-reveal="true" style={reveal(80)}>
              <div style={{ border: `1px solid ${HAIRLINE_DARK}`, background: GRAPHITE_RAISED, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${HAIRLINE_DARK}`, fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: ".16em", textTransform: "uppercase", color: MUTED_TEXT }}>
                  <span>Executive overview · Q3 2026</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 7, height: 7, background: OCHRE, animation: "atlasLandingPulse 1.8s ease-in-out infinite" }} />
                    live
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 1, background: HAIRLINE_DARK }}>
                  {[
                    ["NET SALES", "184.2M"],
                    ["COLLECTED", "92.4%"],
                    ["AVAILABLE", "318"],
                  ].map(([label, value]) => (
                    <div key={label} style={{ background: GRAPHITE, padding: "14px 16px" }}>
                      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: ".14em", color: MUTED_TEXT }}>{label}</div>
                      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 22, marginTop: 5 }}>{value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10, borderTop: `1px solid ${HAIRLINE_DARK}` }}>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: MUTED_TEXT }}>Marina Heights · Tower B</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {heroFloors.map((f) => (
                      <div key={f.label} style={{ display: "flex", gap: 3 }}>
                        {f.units.map((u, ci) => (
                          <div key={ci} style={{ flex: 1, aspectRatio: "1.3", background: u.bg, border: `1px solid ${u.border}` }} />
                        ))}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 14, fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: ".1em", color: MUTED_TEXT, flexWrap: "wrap" }}>
                    <span>A AVAILABLE</span>
                    <span style={{ color: OCHRE }}>R RESERVED</span>
                    <span style={{ color: CYAN_STRONG }}>C CONTRACTED</span>
                    <span style={{ color: GREEN_STRONG }}>S SOLD</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 01 The problem ──────────────────────────────────── */}
        <section style={{ padding: "clamp(48px,7vw,104px) clamp(18px,4vw,48px)", borderBottom: `1px solid ${HAIRLINE}` }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", flexDirection: "column", gap: "clamp(28px,4vw,48px)" }}>
            <div data-reveal="true" style={{ display: "flex", flexDirection: "column", gap: 16, ...reveal() }}>
              <div style={EYEBROW}>01 — The problem</div>
              <h2 style={H2}>Your business is connected. Your tools should be too.</h2>
              <p style={{ margin: 0, maxWidth: "62ch", fontSize: 17, lineHeight: 1.6, color: BODY_TEXT, textWrap: "pretty" }}>
                Most real-estate companies run on a CRM that doesn't know what a unit is, spreadsheets that hold the payment plans, and a shared drive that holds the contracts. The work gets done, but nobody can see all of it at once.
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
              <div data-reveal="true" style={{ background: SURFACE, border: `1px solid ${HAIRLINE}`, padding: 26, display: "flex", flexDirection: "column", gap: 18, ...reveal() }}>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: RED }}>Fragmented today</div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {PROBLEMS.map((p) => (
                    <div key={p} style={{ display: "flex", gap: 12, padding: "11px 0", borderBottom: `1px solid ${CANVAS}`, alignItems: "flex-start" }}>
                      <span style={{ width: 10, height: 10, background: `repeating-linear-gradient(45deg,${FAINT_TEXT},${FAINT_TEXT} 2px,${SURFACE} 2px,${SURFACE} 4px)`, border: `1px solid ${FAINT_TEXT}`, flex: "none", marginTop: 4 }} />
                      <span style={{ fontSize: 14, lineHeight: 1.45, color: BODY_TEXT }}>{p}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div data-reveal="true" style={{ background: GRAPHITE, color: PAPER, padding: 26, display: "flex", flexDirection: "column", gap: 18, ...reveal(60) }}>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: OCHRE }}>One system with Atlas</div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {ANSWERS.map((a) => (
                    <div key={a} style={{ display: "flex", gap: 12, padding: "11px 0", borderBottom: `1px solid ${HAIRLINE_DARK}`, alignItems: "flex-start" }}>
                      <span style={{ width: 10, height: 10, background: OCHRE, flex: "none", marginTop: 4 }} />
                      <span style={{ fontSize: 14, lineHeight: 1.45, color: FAINT_TEXT }}>{a}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 02 The Atlas concept ────────────────────────────── */}
        <section id="platform" style={{ padding: "clamp(48px,7vw,104px) clamp(18px,4vw,48px)", borderBottom: `1px solid ${HAIRLINE}`, background: SURFACE, scrollMarginTop: 58 }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", flexDirection: "column", gap: "clamp(28px,4vw,44px)" }}>
            <div data-reveal="true" style={{ display: "flex", flexDirection: "column", gap: 16, ...reveal() }}>
              <div style={EYEBROW}>02 — The Atlas concept</div>
              <h2 style={H2}>One connected business. One source of truth.</h2>
              <p style={{ margin: 0, maxWidth: "62ch", fontSize: 17, lineHeight: 1.6, color: BODY_TEXT, textWrap: "pretty" }}>
                Atlas is not another tool added to the stack. It is the operational layer the company runs on — three layers working on the same records, not three systems exchanging exports.
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(270px,1fr))", gap: 1, background: HAIRLINE, border: `1px solid ${HAIRLINE}` }}>
              <div data-reveal="true" style={{ background: SURFACE, padding: 26, display: "flex", flexDirection: "column", gap: 18, ...reveal() }}>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: MUTED_TEXT }}>Business flow</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, fontFamily: "'IBM Plex Mono',monospace", fontSize: 13 }}>
                  {FLOW_BUSINESS.map((s) => (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 6, height: 6, background: INK, flex: "none" }} />
                      {s}
                    </div>
                  ))}
                </div>
              </div>
              <div data-reveal="true" style={{ background: SURFACE, padding: 26, display: "flex", flexDirection: "column", gap: 18, ...reveal(50) }}>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: MUTED_TEXT }}>Operational layer</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, fontFamily: "'IBM Plex Mono',monospace", fontSize: 13 }}>
                  {FLOW_OPS.map((s) => (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 6, height: 6, background: OCHRE, flex: "none" }} />
                      {s}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.55, color: SECONDARY_TEXT }}>Execution stays attached to the record it belongs to — the unit, the contract, the installment.</div>
              </div>
              <div data-reveal="true" style={{ background: SURFACE, padding: 26, display: "flex", flexDirection: "column", gap: 18, ...reveal(100) }}>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: MUTED_TEXT }}>Intelligence layer</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, fontFamily: "'IBM Plex Mono',monospace", fontSize: 13 }}>
                  {FLOW_INTEL.map((s) => (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 6, height: 6, background: CYAN, flex: "none" }} />
                      {s}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.55, color: SECONDARY_TEXT }}>Analytics and AI read the operating data directly, so insight and record never disagree.</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 03 Product overview ─────────────────────────────── */}
        <section style={{ padding: "clamp(48px,7vw,104px) clamp(18px,4vw,48px)", borderBottom: `1px solid ${HAIRLINE}` }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", flexDirection: "column", gap: "clamp(28px,4vw,40px)" }}>
            <div data-reveal="true" style={{ display: "flex", flexDirection: "column", gap: 16, ...reveal() }}>
              <div style={EYEBROW}>03 — Product overview</div>
              <h2 style={{ ...H2, maxWidth: "26ch" }}>Eight domains, one data model.</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 1, background: HAIRLINE, border: `1px solid ${HAIRLINE}` }}>
              {DOMAINS.map((d) => (
                <div key={d.num} data-reveal="true" style={{ background: SURFACE, padding: 24, display: "flex", flexDirection: "column", gap: 14, ...reveal() }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                    <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-.02em" }}>{d.name}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: MUTED_TEXT }}>{d.num}</span>
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.55, color: BODY_TEXT }}>{d.body}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 04 Properties & inventory ───────────────────────── */}
        <section id="inventory" style={{ padding: "clamp(48px,7vw,104px) clamp(18px,4vw,48px)", borderBottom: `1px solid ${HAIRLINE}`, background: CANVAS, scrollMarginTop: 58 }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: "clamp(28px,4vw,48px)", alignItems: "start" }}>
            <div data-reveal="true" style={{ display: "flex", flexDirection: "column", gap: 20, ...reveal() }}>
              <div style={EYEBROW}>04 — Properties &amp; inventory</div>
              <h2 style={{ ...H2, maxWidth: "none" }}>Know your inventory. At every level.</h2>
              <p style={{ margin: 0, maxWidth: "52ch", fontSize: 17, lineHeight: 1.6, color: BODY_TEXT, textWrap: "pretty" }}>
                Atlas models property the way you own it: project, building, floor, unit. The Unit Plate puts an entire development on one screen — every cell is a real unit, and every colour is its current commercial state.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, letterSpacing: ".06em", color: SECONDARY_TEXT }}>
                <div style={{ color: INK }}>PROJECT → BUILDING → FLOOR → UNIT</div>
                <div>Drill from portfolio to a single unit in three clicks.</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 1, background: FAINT_TEXT, border: `1px solid ${FAINT_TEXT}` }}>
                {UNIT_FACTS.map((u) => (
                  <div key={u} style={{ background: PAPER, padding: "12px 14px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, letterSpacing: ".06em", color: BODY_TEXT }}>
                    {u}
                  </div>
                ))}
              </div>
            </div>
            <div data-reveal="true" style={{ background: SURFACE, border: `1px solid ${FAINT_TEXT}`, padding: 20, display: "flex", flexDirection: "column", gap: 14, minWidth: 0, ...reveal(60) }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>Unit Plate — Tower B</span>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: ".1em", color: MUTED_TEXT }}>ATL-MRN-B</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {plateFloors.map((f) => (
                  <div key={f.label} style={{ display: "flex", gap: 3, alignItems: "center" }}>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: MUTED_TEXT, width: 24, flex: "none" }}>{f.label}</span>
                    {f.units.map((u, ci) => (
                      <div
                        key={ci}
                        style={{ flex: 1, minWidth: 18, aspectRatio: "1.25", background: u.bg, border: `1px solid ${u.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: u.fg }}
                      >
                        {u.code}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 12, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11 }}>
                <div>
                  <span style={{ color: MUTED_TEXT, fontSize: 9, letterSpacing: ".14em" }}>UNIT</span>
                  <br />
                  B2-1104
                </div>
                <div>
                  <span style={{ color: MUTED_TEXT, fontSize: 9, letterSpacing: ".14em" }}>STATE</span>
                  <br />
                  <span style={{ color: OCHRE_DEEP }}>Reserved</span>
                </div>
                <div>
                  <span style={{ color: MUTED_TEXT, fontSize: 9, letterSpacing: ".14em" }}>PRICE</span>
                  <br />
                  2,940,000
                </div>
                <div>
                  <span style={{ color: MUTED_TEXT, fontSize: 9, letterSpacing: ".14em" }}>AGENT</span>
                  <br />
                  N. Fares
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 05/06 CRM & Sales / Finance & Collections ───────── */}
        <section style={{ padding: "clamp(48px,7vw,104px) clamp(18px,4vw,48px)", borderBottom: `1px solid ${HAIRLINE}` }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", flexDirection: "column", gap: "clamp(36px,5vw,72px)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: "clamp(24px,4vw,44px)", alignItems: "start" }}>
              <div data-reveal="true" style={{ display: "flex", flexDirection: "column", gap: 18, ...reveal() }}>
                <div style={EYEBROW}>05 — CRM &amp; sales</div>
                <h2 style={{ margin: 0, fontSize: "clamp(25px,3.2vw,38px)", fontWeight: 600, letterSpacing: "-.03em", lineHeight: 1.1 }}>Turn every opportunity into a connected sales journey.</h2>
                <p style={{ margin: 0, maxWidth: "50ch", fontSize: 16, lineHeight: 1.6, color: BODY_TEXT, textWrap: "pretty" }}>
                  A lead isn't just a contact. It's a potential transaction attached to real inventory — so the pipeline stage, the interested units and the reservation that follows are the same thread.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {CRM_TAGS.map((t) => (
                    <span key={t} style={{ border: `1px solid ${FAINT_TEXT}`, padding: "7px 11px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, letterSpacing: ".04em", color: BODY_TEXT, whiteSpace: "nowrap" }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div data-reveal="true" style={{ background: SURFACE, border: `1px solid ${HAIRLINE}`, padding: 20, display: "flex", flexDirection: "column", gap: 14, minWidth: 0, ...reveal(60) }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>Pipeline</span>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: MUTED_TEXT }}>9 stages · 412 open</span>
                </div>
                {PIPELINE_STAGES.map((s) => (
                  <div key={s.name} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11 }}>
                      <span style={{ color: SECONDARY_TEXT }}>{s.name}</span>
                      <span>{s.value}</span>
                    </div>
                    <div style={{ height: 6, background: CANVAS }}>
                      <div style={{ height: 6, background: GRAPHITE_HOVER, width: s.w }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div id="finance" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: "clamp(24px,4vw,44px)", alignItems: "start", scrollMarginTop: 58 }}>
              <div data-reveal="true" style={{ background: SURFACE, border: `1px solid ${HAIRLINE}`, display: "flex", flexDirection: "column", minWidth: 0, order: 2, ...reveal() }}>
                <div style={{ padding: "16px 18px", borderBottom: `1px solid ${HAIRLINE}`, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>Collections</span>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: RED }}>14 overdue</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr .7fr", gap: 10, padding: "9px 18px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: MUTED_TEXT, background: PAPER, borderBottom: `1px solid ${HAIRLINE}` }}>
                  <span>Unit / customer</span>
                  <span style={{ textAlign: "right" }}>Amount</span>
                  <span style={{ textAlign: "right" }}>Due</span>
                </div>
                {COLLECTION_ROWS.map((r) => (
                  <div key={r.unit} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr .7fr", gap: 10, padding: "11px 18px", borderBottom: `1px solid ${CANVAS}`, alignItems: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                      <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }}>{r.unit}</span>
                      <span style={{ fontSize: 11, color: SECONDARY_TEXT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.customer}</span>
                    </div>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, textAlign: "right" }}>{r.amount}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, textAlign: "right", color: r.color }}>{r.due}</span>
                  </div>
                ))}
              </div>
              <div data-reveal="true" style={{ display: "flex", flexDirection: "column", gap: 18, order: 1, ...reveal(60) }}>
                <div style={EYEBROW}>06 — Finance &amp; collections</div>
                <h2 style={{ margin: 0, fontSize: "clamp(25px,3.2vw,38px)", fontWeight: 600, letterSpacing: "-.03em", lineHeight: 1.1 }}>Know what is due, what is paid, and what needs attention.</h2>
                <p style={{ margin: 0, maxWidth: "50ch", fontSize: 16, lineHeight: 1.6, color: BODY_TEXT, textWrap: "pretty" }}>
                  Every contract generates its payment plan; every plan generates installments; every installment resolves to a payment or an aging balance. Finance works from the same records sales created.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, letterSpacing: ".06em", color: INK }}>PAYMENT PLAN → INSTALLMENTS → PAYMENTS → COLLECTIONS</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {FIN_TAGS.map((t) => (
                      <span key={t} style={{ border: `1px solid ${FAINT_TEXT}`, padding: "7px 11px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: BODY_TEXT, whiteSpace: "nowrap" }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 07/08 Operations / Analytics ────────────────────── */}
        <section style={{ padding: "clamp(48px,7vw,104px) clamp(18px,4vw,48px)", borderBottom: `1px solid ${HAIRLINE}`, background: SURFACE }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
            <div data-reveal="true" style={{ display: "flex", flexDirection: "column", gap: 16, ...reveal() }}>
              <div style={EYEBROW}>07 — Operations</div>
              <h2 style={{ margin: 0, fontSize: "clamp(24px,3vw,34px)", fontWeight: 600, letterSpacing: "-.03em", lineHeight: 1.1 }}>From selling units to running the business.</h2>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: BODY_TEXT, maxWidth: "46ch", textWrap: "pretty" }}>
                The sale is the start of the work. Tasks, workflow steps, approvals and documents keep the company executing after the contract is signed — each one attached to the record it concerns.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 1, background: HAIRLINE, border: `1px solid ${HAIRLINE}` }}>
                {OPS_ITEMS.map((o) => (
                  <div key={o.name} style={{ background: SURFACE, padding: "12px 14px", display: "flex", justifyContent: "space-between", gap: 14, fontSize: 14 }}>
                    <span>{o.name}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: MUTED_TEXT, textAlign: "right" }}>{o.note}</span>
                  </div>
                ))}
              </div>
            </div>
            <div data-reveal="true" style={{ display: "flex", flexDirection: "column", gap: 16, ...reveal(50) }}>
              <div style={EYEBROW}>08 — Analytics</div>
              <h2 style={{ margin: 0, fontSize: "clamp(24px,3vw,34px)", fontWeight: 600, letterSpacing: "-.03em", lineHeight: 1.1 }}>See the business behind the numbers.</h2>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: BODY_TEXT, maxWidth: "46ch", textWrap: "pretty" }}>
                Because operations and finance share one model, management reporting is a view rather than a reconciliation. Performance, velocity and exposure are current, not monthly.
              </p>
              <div style={{ border: `1px solid ${HAIRLINE}`, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 96, borderBottom: `1px solid ${HAIRLINE}` }}>
                  {ANALYTICS_BAR_HEIGHTS.map((h, i) => (
                    <div key={i} style={{ flex: 1, height: `${h}%`, background: GRAPHITE_HOVER }} />
                  ))}
                  <div style={{ flex: 1, height: "58%", background: `repeating-linear-gradient(0deg,${CYAN},${CYAN} 3px,transparent 3px,transparent 6px)` }} />
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {ANALYTICS_TAGS.map((t) => (
                    <span key={t} style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: SECONDARY_TEXT, whiteSpace: "nowrap" }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 09 AI Copilot ────────────────────────────────────── */}
        <section id="ai-copilot" style={{ padding: "clamp(48px,7vw,104px) clamp(18px,4vw,48px)", background: GRAPHITE, color: PAPER, scrollMarginTop: 58 }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: "clamp(28px,4vw,48px)", alignItems: "center" }}>
            <div data-reveal="true" style={{ display: "flex", flexDirection: "column", gap: 20, ...reveal() }}>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: CYAN_STRONG }}>09 — AI Copilot</div>
              <h2 style={{ margin: 0, fontSize: "clamp(27px,3.6vw,44px)", fontWeight: 600, letterSpacing: "-.03em", lineHeight: 1.06 }}>Ask your business. Get answers from your data.</h2>
              <p style={{ margin: 0, maxWidth: "50ch", fontSize: 17, lineHeight: 1.6, color: FAINT_TEXT, textWrap: "pretty" }}>
                Copilot is not a chatbot bolted onto a help centre. It reads your pipeline, inventory, contracts and installments, answers in your own numbers, and cites the records behind every claim.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {AI_ASKS.map((q) => (
                  <div key={q} style={{ border: `1px solid ${HAIRLINE_DARK}`, padding: "11px 14px", fontSize: 14, color: PAPER }}>
                    {q}
                  </div>
                ))}
              </div>
              <Link to="/login" style={{ border: `1px solid ${CYAN_STRONG}`, color: CYAN_STRONG, padding: "13px 20px", fontSize: 14, alignSelf: "flex-start", whiteSpace: "nowrap", display: "inline-block" }}>
                Explore AI Copilot
              </Link>
            </div>
            <div data-reveal="true" style={{ border: `1px solid ${HAIRLINE_DARK}`, display: "flex", flexDirection: "column", ...reveal(60) }}>
              <div style={{ padding: "14px 18px", borderBottom: `1px solid ${HAIRLINE_DARK}`, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 8, height: 8, background: CYAN_STRONG }} />
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: CYAN_STRONG, whiteSpace: "nowrap" }}>Atlas Copilot</span>
              </div>
              <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ alignSelf: "flex-end", maxWidth: "82%", background: GRAPHITE_HOVER, padding: "11px 14px", fontSize: 13, lineHeight: 1.5 }}>
                  Which projects will miss Q4 collection targets?
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, borderLeft: `2px solid ${CYAN}`, paddingLeft: 14 }}>
                  <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                    Two of nine. Marina Heights C is 8.4M behind a 42M target, driven by 11 installments overdue past 60 days. Sahel Villas is 2.1M behind and recoverable within the quarter.
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: HAIRLINE_DARK, border: `1px solid ${HAIRLINE_DARK}` }}>
                    <div style={{ background: GRAPHITE, padding: 12 }}>
                      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: ".14em", color: MUTED_TEXT }}>GAP</div>
                      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 19, color: RED }}>−10.5M</div>
                    </div>
                    <div style={{ background: GRAPHITE, padding: 12 }}>
                      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: ".14em", color: MUTED_TEXT }}>RECOVERABLE</div>
                      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 19, color: CYAN_STRONG }}>6.3M</div>
                    </div>
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: ".1em", color: SECONDARY_TEXT, textTransform: "uppercase" }}>Derived from 1,240 installments · 2026-09-15</div>
                </div>
              </div>
              <div style={{ padding: "14px 18px", borderTop: `1px solid ${HAIRLINE_DARK}`, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: SECONDARY_TEXT }}>Ask Atlas…</div>
            </div>
          </div>
        </section>

        {/* ── 10 One connected lifecycle ──────────────────────── */}
        <section ref={lifecycleRef} style={{ background: GRAPHITE_RAISED, color: PAPER, padding: "clamp(48px,7vw,96px) clamp(18px,4vw,48px)" }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: "clamp(28px,4vw,56px)", alignItems: "start" }}>
            <div style={{ position: "sticky", top: 96, display: "flex", flexDirection: "column", gap: 24 }}>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: OCHRE }}>10 — One connected lifecycle</div>
              <h2 style={{ margin: 0, fontSize: "clamp(27px,3.6vw,42px)", fontWeight: 600, letterSpacing: "-.03em", lineHeight: 1.06 }}>Every stage connected. Every decision informed.</h2>
              <LifecycleMark active={active} />
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, letterSpacing: ".06em", color: MUTED_TEXT }}>
                Stage {String(active + 1).padStart(2, "0")} of 07 — the plate assembles as the lifecycle completes.
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 1, background: HAIRLINE_DARK, border: `1px solid ${HAIRLINE_DARK}` }}>
              {lifecycle.map((l) => (
                <div key={l.n} style={{ background: l.bg, padding: "22px 24px", display: "flex", gap: 18, alignItems: "flex-start", transition: "background .3s cubic-bezier(.2,0,0,1)" }}>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: l.num, width: 24, flex: "none", paddingTop: 4 }}>{l.n}</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                    <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-.02em", color: l.fg, transition: "color .3s" }}>{l.name}</span>
                    <span style={{ fontSize: 14, lineHeight: 1.55, color: FAINT_TEXT }}>{l.body}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 11 Built for real estate ─────────────────────────── */}
        <section style={{ padding: "clamp(48px,7vw,104px) clamp(18px,4vw,48px)", borderBottom: `1px solid ${HAIRLINE}` }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", flexDirection: "column", gap: "clamp(28px,4vw,44px)" }}>
            <div data-reveal="true" style={{ display: "flex", flexDirection: "column", gap: 16, ...reveal() }}>
              <div style={EYEBROW}>11 — Built for real estate</div>
              <h2 style={H2}>Built around the way real estate actually works.</h2>
              <p style={{ margin: 0, maxWidth: "62ch", fontSize: 17, lineHeight: 1.6, color: BODY_TEXT, textWrap: "pretty" }}>
                A generic CRM can store a deal. It cannot hold a floor plan of availability, a 60/40 payment plan, or a commission that only vests on collection. Atlas treats these as first-class objects.
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 1, background: HAIRLINE, border: `1px solid ${HAIRLINE}` }}>
              {NATIVE_OBJECTS.map((o) => (
                <div key={o} data-reveal="true" style={{ background: SURFACE, padding: 18, display: "flex", flexDirection: "column", gap: 8, opacity: 0, transform: "translateY(12px)", transition: "opacity .45s cubic-bezier(.2,0,0,1), transform .45s cubic-bezier(.2,0,0,1)" }}>
                  <span style={{ width: 10, height: 10, background: OCHRE }} />
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{o}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 12 For every team ───────────────────────────────── */}
        <section style={{ padding: "clamp(48px,7vw,104px) clamp(18px,4vw,48px)", borderBottom: `1px solid ${HAIRLINE}`, background: SURFACE }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", flexDirection: "column", gap: "clamp(28px,4vw,44px)" }}>
            <div data-reveal="true" style={{ display: "flex", flexDirection: "column", gap: 14, ...reveal() }}>
              <div style={EYEBROW}>12 — For every team</div>
              <h2 style={{ margin: 0, fontSize: "clamp(27px,3.6vw,44px)", fontWeight: 600, letterSpacing: "-.03em" }}>One platform. Every team.</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 1, background: HAIRLINE, border: `1px solid ${HAIRLINE}` }}>
              {TEAMS.map((t) => (
                <div key={t.role} data-reveal="true" style={{ background: SURFACE, padding: 24, display: "flex", flexDirection: "column", gap: 12, opacity: 0, transform: "translateY(12px)", transition: "opacity .45s cubic-bezier(.2,0,0,1), transform .45s cubic-bezier(.2,0,0,1)" }}>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: MUTED_TEXT }}>{t.role}</div>
                  <div style={{ fontSize: 15, lineHeight: 1.55, color: INK }}>{t.body}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 16 }}>
              {[
                ["Operate", "CRM, properties, sales, finance and operations run the day — one record per lead, unit, contract and installment."],
                ["Understand", "Dashboards, reports and performance views read the operating data directly — no exports, no month-end rebuild."],
                ["Decide", "Copilot and insight surface what changed, what it costs, and the action that resolves it."],
              ].map(([title, body], i) => (
                <div key={title} data-reveal="true" style={{ border: `1px solid ${HAIRLINE}`, padding: 26, display: "flex", flexDirection: "column", gap: 12, ...reveal(i * 50) }}>
                  <div style={EYEBROW}>{title}</div>
                  <div style={{ fontSize: 15, lineHeight: 1.55, color: BODY_TEXT }}>{body}</div>
                </div>
              ))}
            </div>
            <div data-reveal="true" style={{ fontSize: "clamp(19px,2.4vw,28px)", fontWeight: 600, letterSpacing: "-.025em", lineHeight: 1.2, maxWidth: "28ch", opacity: 0, transform: "translateY(12px)", transition: "opacity .45s cubic-bezier(.2,0,0,1), transform .45s cubic-bezier(.2,0,0,1)" }}>
              Run the business. Understand the business. Improve the business.
            </div>
          </div>
        </section>

        {/* ── 13 Enterprise foundation ────────────────────────── */}
        <section style={{ padding: "clamp(48px,7vw,104px) clamp(18px,4vw,48px)", borderBottom: `1px solid ${HAIRLINE}`, background: CANVAS }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: "clamp(24px,4vw,44px)", alignItems: "start" }}>
            <div data-reveal="true" style={{ display: "flex", flexDirection: "column", gap: 16, ...reveal() }}>
              <div style={EYEBROW}>13 — Enterprise foundation</div>
              <h2 style={{ margin: 0, fontSize: "clamp(25px,3.2vw,40px)", fontWeight: 600, letterSpacing: "-.03em", lineHeight: 1.08 }}>Built for businesses that are built to scale.</h2>
              <p style={{ margin: 0, maxWidth: "48ch", fontSize: 16, lineHeight: 1.6, color: BODY_TEXT, textWrap: "pretty" }}>
                Atlas runs on AURIC Core, the foundation behind our vertical products. Growth means more projects, more agents and more entities — not a migration.
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 1, background: FAINT_TEXT, border: `1px solid ${FAINT_TEXT}` }}>
              {FOUNDATION.map((f) => (
                <div key={f.name} data-reveal="true" style={{ background: PAPER, padding: 20, display: "flex", flexDirection: "column", gap: 8, opacity: 0, transform: "translateY(12px)", transition: "opacity .45s cubic-bezier(.2,0,0,1), transform .45s cubic-bezier(.2,0,0,1)" }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{f.name}</span>
                  <span style={{ fontSize: 13, lineHeight: 1.5, color: SECONDARY_TEXT }}>{f.body}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────── */}
        <section style={{ padding: "clamp(56px,8vw,120px) clamp(18px,4vw,48px)", background: GRAPHITE, color: PAPER }}>
          <div data-reveal="true" style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 26, alignItems: "flex-start", ...reveal() }}>
            <LogoMark size={56} tone="paper" />
            <h2 style={{ margin: 0, fontSize: "clamp(30px,4.6vw,56px)", fontWeight: 600, letterSpacing: "-.035em", lineHeight: 1.02, textWrap: "balance" }}>Your real estate business deserves one system.</h2>
            <p style={{ margin: 0, maxWidth: "56ch", fontSize: "clamp(16px,1.6vw,19px)", lineHeight: 1.55, color: FAINT_TEXT, textWrap: "pretty" }}>
              Bring sales, inventory, finance, operations, analytics and intelligence together with Atlas RE OS.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link to="/login" style={CTA_PRIMARY}>
                Request a Demo
              </Link>
              <Link to="/login" style={CTA_GHOST}>
                Talk to Atlas
              </Link>
            </div>
          </div>
        </section>

        {/* ── Footer ───────────────────────────────────────────── */}
        <footer style={{ background: GRAPHITE_RAISED, color: MUTED_TEXT, padding: "clamp(36px,5vw,64px) clamp(18px,4vw,48px) 28px", borderTop: `1px solid ${HAIRLINE_DARK}` }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", flexDirection: "column", gap: 36 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 32 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: "34ch" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <LogoMark size={26} tone="paper" />
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 7, color: PAPER }}>
                    <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-.03em", lineHeight: 1 }}>ATLAS</span>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: ".18em", whiteSpace: "nowrap" }}>RE OS</span>
                  </div>
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.55 }}>The operating system for real estate companies — from the first lead to the final payment.</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: ".16em", textTransform: "uppercase", color: SECONDARY_TEXT }}>Product</div>
                <span>CRM &amp; Sales</span>
                <span>Properties &amp; Inventory</span>
                <span>Finance &amp; Collections</span>
                <span>Operations</span>
                <span>Analytics</span>
                <span>AI Copilot</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: ".16em", textTransform: "uppercase", color: SECONDARY_TEXT }}>Platform</div>
                <span>AURIC Core</span>
                <span>Roles &amp; permissions</span>
                <span>Documents</span>
                <span>Notifications</span>
                <span>Audit trail</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: ".16em", textTransform: "uppercase", color: SECONDARY_TEXT }}>Company</div>
                <span>About</span>
                <span>Careers</span>
                <span>Contact</span>
                <span>Request a Demo</span>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap", borderTop: `1px solid ${HAIRLINE_DARK}`, paddingTop: 20, fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase" }}>
              <span>Atlas RE OS — An AURIC product</span>
              <span style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                <span>Privacy</span>
                <span>Terms</span>
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
