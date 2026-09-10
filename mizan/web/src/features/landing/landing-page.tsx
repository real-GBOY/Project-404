import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AI,
  AI_CHAIN,
  AI_ORDER,
  AFTER,
  BEFORE,
  BRASS,
  CARD,
  css as S,
  DOC_CATS,
  DOCS,
  FLOW,
  HERO_HEARINGS,
  MODULES,
  NAVY,
  PAPER,
  pill,
  SCATTERED,
  SECURITY,
  SHOT_ORDER,
  SHOTS,
  SLATE,
  UNIFIED,
  actionStyle,
  head,
  shotCellStyle,
} from "./landing-data";

const DEMO_HREF = "mailto:hello@mizan.legal?subject=Mizan%20demo%20request";

/** A single Material Symbols Rounded glyph, coloured inline. */
function Sym({
  name,
  size = 20,
  color,
  style,
}: {
  name: string;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className="material-symbols-rounded select-none"
      aria-hidden
      style={{
        fontSize: size,
        lineHeight: 1,
        color,
        fontVariationSettings: `"FILL" 0, "wght" 400, "GRAD" 0, "opsz" ${size}`,
        ...style,
      }}
    >
      {name}
    </span>
  );
}

function Mark({ size = 26, stroke = PAPER, dot = true }: { size?: number; stroke?: string; dot?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" stroke={stroke} strokeWidth={4.5} strokeLinecap="round" aria-hidden>
      <path d="M50 26 V 78" />
      <path d="M36 81 H 64" />
      <path d="M16 32 H 84" />
      <path d="M16 32 V 42" />
      <path d="M84 32 V 42" />
      <circle cx="16" cy="53" r="11" />
      <circle cx="84" cy="53" r="11" />
      {dot && <circle cx="50" cy="22" r="4.5" fill={BRASS} stroke="none" />}
    </svg>
  );
}

const SECTION_STYLE = "scroll-margin-top:90px";
const SHELL = "max-width:1280px;margin:0 auto;padding:0 clamp(20px,4vw,48px)";
const EYEBROW = "font-size:10.5px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:#B99A5B;margin-bottom:16px";
const H2 = "font-family:Spectral,Georgia,serif;font-size:clamp(29px,3.9vw,46px);font-weight:400;line-height:1.14;margin:0";

const NAV_LINKS: [string, string][] = [
  ["#platform", "Platform"],
  ["#features", "Features"],
  ["#ai", "AI"],
  ["#security", "Security"],
  ["#about", "About"],
];

export function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [shot, setShot] = useState<string>("matters");
  const [ai, setAi] = useState<string>("summarize");
  const [thinking, setThinking] = useState(false);
  const [flow, setFlow] = useState(1);
  const [docIdx, setDocIdx] = useState(0);
  const [hoverModule, setHoverModule] = useState(-1);
  const aiTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    document.title = "Mizan — Practice management for law firms";
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Reveal-on-scroll: sections on screen at mount stay put; those below fade up.
  useEffect(() => {
    const els = Array.from(rootRef.current?.querySelectorAll<HTMLElement>("[data-reveal]") ?? []);
    if (!els.length || typeof IntersectionObserver !== "function") return;

    const show = (el: HTMLElement) => {
      el.style.opacity = "1";
      el.style.transform = "none";
    };
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          show(e.target as HTMLElement);
          io.unobserve(e.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px" },
    );

    els.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top > window.innerHeight * 0.92) {
        el.style.opacity = "0";
        el.style.transform = "translateY(18px)";
        el.style.transition =
          "opacity .7s cubic-bezier(.2,.7,.3,1), transform .7s cubic-bezier(.2,.7,.3,1)";
        io.observe(el);
      }
    });
    const guard = window.setTimeout(() => els.forEach(show), 1400);
    return () => {
      io.disconnect();
      window.clearTimeout(guard);
    };
  }, []);

  useEffect(() => () => window.clearTimeout(aiTimer.current), []);

  const askAi = (key: string) => {
    if (key === ai) return;
    setAi(key);
    setThinking(true);
    window.clearTimeout(aiTimer.current);
    aiTimer.current = setTimeout(() => setThinking(false), 620);
  };

  const s = SHOTS[shot];
  const a = AI[ai];
  const stage = FLOW[flow];
  const doc = DOCS[docIdx];
  const answered = !thinking;
  const hasRows = !!a.rows && !thinking;

  const navStyle: React.CSSProperties = {
    position: "sticky",
    top: 0,
    zIndex: 60,
    height: scrolled ? 62 : 78,
    background: scrolled ? "rgba(245,243,239,0.94)" : NAVY,
    backdropFilter: scrolled ? "saturate(1.1) blur(8px)" : "none",
    WebkitBackdropFilter: scrolled ? "saturate(1.1) blur(8px)" : "none",
    borderBottom: `1px solid ${scrolled ? "rgba(22,35,58,0.14)" : "transparent"}`,
    transition: "height .28s ease, background .28s ease, border-color .28s ease",
  };
  const navInk = scrolled ? NAVY : PAPER;
  const navMuted = scrolled ? "rgba(22,35,58,0.72)" : "rgba(245,243,239,0.78)";
  const navRule = scrolled ? "rgba(22,35,58,0.14)" : "rgba(245,243,239,0.24)";
  const navCta: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    padding: "9px 16px",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    transition: "background .28s ease,color .28s ease",
    background: scrolled ? NAVY : BRASS,
    color: scrolled ? PAPER : NAVY,
  };

  return (
    <div
      ref={rootRef}
      className="mz-landing"
      style={{
        background: PAPER,
        color: NAVY,
        fontFamily: "'Public Sans',Helvetica,sans-serif",
        overflowX: "hidden",
      }}
    >
      <style>{`
        .mz-landing a { text-decoration: none; transition: opacity .2s ease; }
        .mz-landing a:hover { opacity: .68; }
        .mz-cta-brass:hover { background:#F5F3EF !important; }
        .mz-cta-ghost:hover { background:rgba(245,243,239,0.08) !important; border-color:#F5F3EF !important; }
        .mz-cta-navy:hover { background:#31456B !important; }
        .mz-cta-outline:hover { border-color:#16233A !important; background:rgba(22,35,58,0.04) !important; }
        .mz-rowhover:hover { background:#F5F3EF; }
        @keyframes mzUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:none; } }
        @keyframes mzIn { from { opacity:0; } to { opacity:1; } }
        @keyframes mzPulse { 0%,100% { opacity:0.35; } 50% { opacity:1; } }
      `}</style>

      {/* ── Nav ─────────────────────────────────────────────── */}
      <div style={navStyle}>
        <div
          style={S(
            "max-width:1280px;margin:0 auto;padding:0 clamp(20px,4vw,48px);height:100%;display:flex;align-items:center;gap:clamp(16px,3vw,40px)",
          )}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 11, flex: "0 0 auto", color: navInk }}>
            <Mark size={26} stroke={navInk} />
            <span style={S("font-family:Spectral,Georgia,serif;font-size:21px;font-weight:400;letter-spacing:0.02em")}>
              Mizan
            </span>
          </div>
          <div
            style={S(
              "display:flex;align-items:center;gap:clamp(14px,2.2vw,30px);margin-inline-start:auto;flex-wrap:wrap;justify-content:flex-end",
            )}
          >
            {NAV_LINKS.map(([href, label]) => (
              <a key={href} href={href} style={{ fontSize: 13.5, fontWeight: 500, color: navMuted }}>
                {label}
              </a>
            ))}
            <span style={{ width: 1, height: 20, background: navRule }} />
            <Link to="/login" style={{ fontSize: 13.5, fontWeight: 500, color: navInk }}>
              Sign in
            </Link>
            <a href={DEMO_HREF} style={navCta}>
              Request a demo
            </a>
          </div>
        </div>
      </div>

      {/* ── Hero ────────────────────────────────────────────── */}
      <div style={{ background: NAVY, color: PAPER, position: "relative" }}>
        <div style={S(`${SHELL.replace("padding:0 ", "padding:clamp(52px,7vw,86px) ")} 0`.replace("48px) 0", "48px) 0"))}>
          <div style={S("max-width:1280px;margin:0 auto;padding:0")} />
        </div>
        <div style={S("max-width:1280px;margin:0 auto;padding:clamp(52px,7vw,86px) clamp(20px,4vw,48px) 0")}>
          <div
            style={S(
              "display:flex;align-items:center;gap:14px;margin-bottom:clamp(26px,3.4vw,38px);animation:mzIn .6s ease-out both",
            )}
          >
            <span style={{ width: 6, height: 6, background: BRASS, flex: "0 0 6px" }} />
            <span
              style={S(
                "font-size:10.5px;font-weight:600;letter-spacing:0.22em;text-transform:uppercase;color:rgba(245,243,239,0.72);white-space:nowrap",
              )}
            >
              Legal practice management
            </span>
            <span style={{ flex: 1, height: 1, background: "rgba(245,243,239,0.2)", minWidth: 20 }} />
            <span
              style={S(
                "font-size:10.5px;font-weight:500;letter-spacing:0.16em;text-transform:uppercase;color:rgba(245,243,239,0.5);white-space:nowrap",
              )}
            >
              Cairo · Abu Dhabi
            </span>
          </div>

          <h1
            style={S(
              "font-family:Spectral,Georgia,serif;font-size:clamp(44px,7.6vw,104px);font-weight:300;line-height:0.98;letter-spacing:-0.005em;margin:0 0 clamp(28px,3.4vw,44px);max-width:15ch;text-wrap:balance;animation:mzUp .8s cubic-bezier(.2,.7,.3,1) both",
            )}
          >
            Run your firm with{" "}
            <span style={{ fontStyle: "italic", fontWeight: 400, color: BRASS }}>clarity</span>.
          </h1>

          <div
            style={S(
              "display:flex;flex-wrap:wrap;gap:clamp(28px,4vw,56px);align-items:flex-start;padding-bottom:clamp(34px,4.2vw,52px)",
            )}
          >
            <div
              style={S(
                "flex:1 1 380px;min-width:min(100%,300px);animation:mzUp .8s cubic-bezier(.2,.7,.3,1) .1s both",
              )}
            >
              <p
                style={S(
                  "font-size:clamp(15.5px,1.35vw,19px);font-weight:300;line-height:1.6;color:rgba(245,243,239,0.78);margin:0 0 clamp(26px,3vw,34px);max-width:52ch;text-wrap:pretty",
                )}
              >
                Mizan brings your firm&rsquo;s matters, clients, documents, hearings, tasks, billing, and
                AI-assisted workflows into one intelligent workspace.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                <a
                  href={DEMO_HREF}
                  className="mz-cta-brass"
                  style={S(
                    "display:inline-flex;align-items:center;gap:9px;padding:16px 26px;background:#B99A5B;color:#16233A;font-size:11.5px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;white-space:nowrap",
                  )}
                >
                  Request a demo
                  <Sym name="arrow_forward" size={17} />
                </a>
                <a
                  href="#platform"
                  className="mz-cta-ghost"
                  style={S(
                    "display:inline-flex;align-items:center;gap:9px;padding:16px 26px;border:1px solid rgba(245,243,239,0.38);color:#F5F3EF;font-size:11.5px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;white-space:nowrap",
                  )}
                >
                  Explore the platform
                </a>
              </div>
            </div>

            <div
              style={S(
                "flex:1 1 420px;min-width:min(100%,300px);border:1px solid rgba(245,243,239,0.22);animation:mzUp .9s cubic-bezier(.2,.7,.3,1) .2s both",
              )}
            >
              <div
                style={S(
                  "display:flex;align-items:center;gap:9px;padding:12px 16px;border-bottom:1px solid rgba(245,243,239,0.18)",
                )}
              >
                <span
                  style={S(
                    "width:7px;height:7px;border-radius:9999px;background:#B99A5B;animation:mzPulse 2.4s ease-in-out infinite;flex:0 0 7px",
                  )}
                />
                <span
                  style={S(
                    "font-size:10px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:rgba(245,243,239,0.82)",
                  )}
                >
                  Firm docket
                </span>
                <span
                  style={S(
                    "margin-inline-start:auto;font-size:10px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:rgba(245,243,239,0.5);white-space:nowrap",
                  )}
                >
                  Sun 30 Aug 2026
                </span>
              </div>

              {[
                ["Thu 3 Sep", "Rania Fouad v. Zahran Group", "Hearing · North Cairo Labour Court, Circuit 2", "09:30", null],
                ["Tue 8 Sep", "Al-Ahram Trading v. Delta Logistics", "Hearing · Cairo Economic Court, Circuit 7", "10:00", null],
                ["Tue 1 Sep", "Statement of defence — CRCICA 1188", "Filing deadline · O. Al-Farouq", null, "2 days"],
              ].map(([d, title, sub, time, badge], i) => (
                <div
                  key={i}
                  style={S(
                    "display:flex;align-items:baseline;gap:13px;padding:12px 16px;border-bottom:1px solid rgba(245,243,239,0.1)",
                  )}
                >
                  <span
                    style={S(
                      "width:58px;flex:0 0 58px;font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#B99A5B",
                    )}
                  >
                    {d}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>{title}</div>
                    <div style={{ fontSize: 11, fontWeight: 300, color: "rgba(245,243,239,0.6)", marginTop: 2 }}>
                      {sub}
                    </div>
                  </div>
                  {time && (
                    <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                      {time}
                    </span>
                  )}
                  {badge && (
                    <span
                      style={S(
                        "display:inline-flex;align-items:center;padding:3px 8px;background:rgba(185,154,91,0.18);color:#DFC58A;font-size:10px;font-weight:600;letter-spacing:0.08em;white-space:nowrap",
                      )}
                    >
                      {badge}
                    </span>
                  )}
                </div>
              ))}
              <div style={S("display:flex;align-items:baseline;gap:13px;padding:12px 16px")}>
                <span
                  style={S(
                    "width:58px;flex:0 0 58px;font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#B99A5B",
                  )}
                >
                  Awaiting
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>Expert report — MedSupply marks</div>
                  <div style={{ fontSize: 11, fontWeight: 300, color: "rgba(245,243,239,0.6)", marginTop: 2 }}>
                    Review · matter 0655/2025
                  </div>
                </div>
                <Sym name="arrow_forward" size={17} color="rgba(245,243,239,0.5)" />
              </div>
            </div>
          </div>

          <div
            style={S(
              "display:grid;grid-template-columns:repeat(auto-fit,minmax(min(50%,150px),1fr));gap:1px;background:rgba(245,243,239,0.2);border-top:1px solid rgba(245,243,239,0.2);animation:mzIn 1s ease-out .3s both",
            )}
          >
            {[
              ["68", "Matters in one view", true],
              ["1,284", "Documents filed by matter", false],
              ["23", "Hearings on the calendar", false],
              ["Zero", "Spreadsheets required", false],
            ].map(([n, label, first], i) => (
              <div
                key={i}
                style={S(
                  `background:#16233A;padding:clamp(18px,2.2vw,26px) clamp(4px,1.4vw,20px) clamp(20px,2.4vw,28px) ${first ? "0" : "clamp(14px,1.6vw,22px)"}`,
                )}
              >
                <div style={S("font-family:Spectral,Georgia,serif;font-size:clamp(26px,3vw,36px);font-weight:300;line-height:1")}>
                  {n}
                </div>
                <div
                  style={S(
                    "font-size:10.5px;font-weight:500;letter-spacing:0.16em;text-transform:uppercase;color:rgba(245,243,239,0.55);margin-top:8px",
                  )}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Dashboard preview ───────────────────────────────── */}
      <div style={{ background: "linear-gradient(to bottom,#16233A 0,#16233A 62%,#F5F3EF 62%,#F5F3EF 100%)" }}>
        <div style={S("max-width:1280px;margin:0 auto;padding:0 clamp(20px,4vw,48px) clamp(16px,2vw,24px)")}>
          <div
            style={S(
              "background:#FAF9F6;color:#16233A;border:1px solid rgba(22,35,58,0.16);box-shadow:0 40px 90px -40px rgba(9,15,28,0.6);animation:mzUp 1s cubic-bezier(.2,.7,.3,1) .35s both",
            )}
          >
            <div
              style={S(
                "display:flex;align-items:center;gap:9px;padding:12px 16px;border-bottom:1px solid rgba(245,243,239,0.14);background:#16233A;flex-wrap:wrap",
              )}
            >
              <svg width="17" height="17" viewBox="0 0 100 100" fill="none" stroke="#F5F3EF" strokeWidth={5.5} strokeLinecap="round" aria-hidden>
                <path d="M50 26 V 78" />
                <path d="M36 81 H 64" />
                <path d="M16 32 H 84" />
                <circle cx="16" cy="53" r="11" />
                <circle cx="84" cy="53" r="11" />
              </svg>
              <span
                style={S(
                  "font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:rgba(245,243,239,0.82)",
                )}
              >
                Nayel &amp; Partners · Dashboard
              </span>
              <span
                style={S(
                  "margin-inline-start:auto;display:flex;align-items:center;gap:7px;padding:5px 10px;border:1px solid rgba(185,154,91,0.5)",
                )}
              >
                <Sym name="auto_awesome" size={14} color={BRASS} />
                <span style={S("font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#B99A5B")}>
                  Ask Mizan
                </span>
              </span>
            </div>

            <div style={S("padding:clamp(14px,1.6vw,20px);display:flex;flex-direction:column;gap:12px")}>
              <div style={S("display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1px;background:rgba(22,35,58,0.12)")}>
                {[
                  ["Active matters", "68", false],
                  ["Hearings · 7 days", "3", false],
                  ["Unbilled time", "214.5", false],
                  ["Outstanding", "EGP 4.36M", true],
                ].map(([k, v, dark], i) => (
                  <div key={i} style={S(`background:${dark ? "#16233A" : "#FAF9F6"};padding:14px 16px`)}>
                    <div
                      style={S(
                        `font-size:9.5px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:${dark ? "rgba(245,243,239,0.6)" : "rgba(22,35,58,0.5)"}`,
                      )}
                    >
                      {k}
                    </div>
                    <div
                      style={S(
                        `font-family:Spectral,Georgia,serif;font-size:24px;font-weight:400;margin-top:6px${dark ? ";color:#F5F3EF" : ""}`,
                      )}
                    >
                      {v}
                      {i === 2 && <span style={{ fontSize: 12, color: "rgba(22,35,58,0.5)" }}> hrs</span>}
                    </div>
                  </div>
                ))}
              </div>

              <div style={S("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr));gap:12px")}>
                <div style={S("border:1px solid rgba(22,35,58,0.12)")}>
                  <div
                    style={S(
                      "display:flex;align-items:center;gap:8px;padding:10px 13px;border-bottom:1px solid rgba(22,35,58,0.1)",
                    )}
                  >
                    <span style={S("font-size:10.5px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#31456B")}>
                      Upcoming hearings
                    </span>
                    <span style={S("margin-inline-start:auto;font-size:10.5px;font-weight:500;color:rgba(22,35,58,0.5)")}>
                      Sep 2026
                    </span>
                  </div>
                  {HERO_HEARINGS.map((h, i) => (
                    <div
                      key={i}
                      className="mz-rowhover"
                      style={S(
                        "display:flex;align-items:center;gap:12px;padding:11px 13px;border-bottom:1px solid rgba(22,35,58,0.08)",
                      )}
                    >
                      <div style={S("width:38px;flex:0 0 38px;text-align:center;border-inline-end:1px solid rgba(22,35,58,0.12)")}>
                        <div style={S("font-size:9px;font-weight:600;letter-spacing:0.16em;color:#B99A5B")}>{h.mon}</div>
                        <div style={S("font-family:Spectral,Georgia,serif;font-size:17px;font-weight:400;line-height:1.1")}>
                          {h.day}
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={S(
                            "font-size:12.5px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis",
                          )}
                        >
                          {h.title}
                        </div>
                        <div
                          style={S(
                            "font-size:10.5px;font-weight:400;color:rgba(22,35,58,0.55);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis",
                          )}
                        >
                          {h.court}
                        </div>
                      </div>
                      <div style={S("font-size:11px;font-weight:600;letter-spacing:0.06em;color:#31456B;white-space:nowrap")}>
                        {h.time}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={S("border:1px solid rgba(22,35,58,0.12)")}>
                  <div
                    style={S(
                      "padding:10px 13px;border-bottom:1px solid rgba(22,35,58,0.1);font-size:10.5px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#31456B",
                    )}
                  >
                    Urgent deadlines
                  </div>
                  {[
                    ["#8C3B2E", "Statement of defence — CRCICA 1188", "Due 1 Sep · in 2 days"],
                    ["#7A6A3C", "Cassation memorandum", "Due 9 Sep · in 10 days"],
                    ["#7A6A3C", "Power of attorney renewal", "Due 17 Sep · matter 1042/2026"],
                  ].map(([bar, title, sub], i) => (
                    <div
                      key={i}
                      style={S(
                        `padding:11px 13px;${i < 2 ? "border-bottom:1px solid rgba(22,35,58,0.08);" : ""}display:flex;gap:10px;align-items:flex-start`,
                      )}
                    >
                      <span style={{ width: 3, alignSelf: "stretch", background: bar, minHeight: 26, flex: "0 0 3px" }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{title}</div>
                        <div style={{ fontSize: 10.5, color: "rgba(22,35,58,0.55)", marginTop: 2 }}>{sub}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={S("border:1px solid rgba(22,35,58,0.12)")}>
                  <div
                    style={S(
                      "padding:10px 13px;border-bottom:1px solid rgba(22,35,58,0.1);font-size:10.5px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#31456B",
                    )}
                  >
                    Recent activity
                  </div>
                  {[
                    ["Expert report uploaded to ", "0655/2025", "", "25 Aug · 09:12"],
                    ["Hearing adjourned to 8 Sep on ", "1042/2026", "", "24 Aug · 11:40"],
                    ["Invoice ", "INV-2026-0418", " sent to Zahran Group", "05 Aug · 16:05"],
                  ].map(([pre, strong, post, when], i) => (
                    <div
                      key={i}
                      style={S(
                        `padding:11px 13px;${i < 2 ? "border-bottom:1px solid rgba(22,35,58,0.08);" : ""}font-size:11.5px;font-weight:400;color:rgba(22,35,58,0.75);line-height:1.45`,
                      )}
                    >
                      {pre}
                      <span style={{ fontWeight: 600, color: NAVY }}>{strong}</span>
                      {post}
                      <div style={{ fontSize: 10, color: "rgba(22,35,58,0.5)", marginTop: 3 }}>{when}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Positioning ─────────────────────────────────────── */}
      <div
        data-reveal="1"
        style={S("border-top:1px solid rgba(22,35,58,0.12);border-bottom:1px solid rgba(22,35,58,0.12);background:#FAF9F6")}
      >
        <div style={S("max-width:1280px;margin:0 auto;padding:clamp(56px,7vw,96px) clamp(20px,4vw,48px)")}>
          <div style={S("max-width:62ch;margin-bottom:clamp(38px,5vw,56px)")}>
            <div style={S(EYEBROW)}>Positioning</div>
            <h2 style={S(`${H2};margin:0 0 18px`)}>Everything your firm needs. Nothing scattered.</h2>
            <p
              style={S(
                "font-size:clamp(14.5px,1.15vw,16.5px);font-weight:300;line-height:1.68;color:rgba(22,35,58,0.72);margin:0;text-wrap:pretty",
              )}
            >
              Most firms run on a spreadsheet for matters, a messaging group for updates, a cloud folder for
              documents, someone&rsquo;s calendar for hearings, and a separate ledger for billing. Nothing speaks
              to anything else, and the firm&rsquo;s real state lives in people&rsquo;s heads. Mizan replaces that
              with one system where a matter carries its own documents, hearings, tasks, time and history.
            </p>
          </div>

          <div style={S("display:flex;flex-wrap:wrap;align-items:stretch;gap:clamp(16px,2.4vw,28px)")}>
            <div
              style={S(
                "flex:1 1 280px;min-width:min(100%,260px);border:1px solid rgba(22,35,58,0.14);padding:clamp(18px,2.2vw,24px);background:#F5F3EF",
              )}
            >
              <div
                style={S(
                  "font-size:10px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:rgba(22,35,58,0.5);margin-bottom:16px",
                )}
              >
                Before
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {SCATTERED.map((l) => (
                  <span
                    key={l}
                    style={S(
                      "display:inline-flex;align-items:center;padding:7px 11px;border:1px dashed rgba(22,35,58,0.28);font-size:11.5px;font-weight:400;color:rgba(22,35,58,0.6)",
                    )}
                  >
                    {l}
                  </span>
                ))}
              </div>
              <div style={S("font-size:12px;font-weight:400;line-height:1.6;color:rgba(22,35,58,0.6);margin-top:18px")}>
                Six places to check before you can answer one question.
              </div>
            </div>

            <div style={S("flex:0 0 auto;align-self:center;display:flex;align-items:center;justify-content:center;padding:0 4px")}>
              <Sym name="east" size={26} color={BRASS} />
            </div>

            <div
              style={S(
                "flex:1 1 320px;min-width:min(100%,260px);border:1px solid #16233A;background:#16233A;color:#F5F3EF;padding:clamp(18px,2.2vw,24px)",
              )}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <Mark size={20} stroke={PAPER} />
                <span
                  style={S(
                    "font-size:10px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#B99A5B",
                  )}
                >
                  One workspace
                </span>
              </div>
              <div
                style={S(
                  "font-family:Spectral,Georgia,serif;font-size:clamp(19px,2.1vw,25px);font-weight:400;line-height:1.35;margin-bottom:16px",
                )}
              >
                Matter 1042/2026 holds its own file.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "rgba(245,243,239,0.16)" }}>
                {UNIFIED.map((u) => (
                  <div
                    key={u.label}
                    style={{ display: "flex", alignItems: "center", gap: 11, background: NAVY, padding: "10px 2px" }}
                  >
                    <Sym name={u.icon} size={17} color={BRASS} />
                    <span style={{ fontSize: 12.5, fontWeight: 500, flex: 1 }}>{u.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 400, color: "rgba(245,243,239,0.62)" }}>{u.meta}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Platform ────────────────────────────────────────── */}
      <div id="platform" data-reveal="1" style={S(`max-width:1280px;margin:0 auto;padding:clamp(56px,7vw,100px) clamp(20px,4vw,48px);${SECTION_STYLE}`)}>
        <div
          style={S(
            "display:flex;flex-wrap:wrap;gap:clamp(24px,4vw,60px);align-items:flex-end;margin-bottom:clamp(36px,4.5vw,54px)",
          )}
        >
          <div style={{ flex: "1 1 420px" }}>
            <div style={S(EYEBROW)}>The platform</div>
            <h2 style={S(H2)}>One system for the entire practice.</h2>
          </div>
          <p
            style={S(
              "flex:1 1 300px;font-size:14.5px;font-weight:300;line-height:1.68;color:rgba(22,35,58,0.72);margin:0;max-width:46ch",
            )}
          >
            Six modules, one record. Open a client and you see their matters; open a matter and you see the
            hearings, documents, tasks and invoices attached to it. Nothing is a standalone list.
          </p>
        </div>

        <div
          style={S(
            "display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,270px),1fr));gap:1px;background:rgba(22,35,58,0.14);border:1px solid rgba(22,35,58,0.14)",
          )}
        >
          {MODULES.map((m, i) => {
            const on = hoverModule === i;
            return (
              <div
                key={m.name}
                onMouseEnter={() => setHoverModule(i)}
                onMouseLeave={() => setHoverModule(-1)}
                style={S(
                  `padding:clamp(20px,2.4vw,28px);cursor:default;transition:background .25s ease,color .25s ease;background:${on ? NAVY : CARD};color:${on ? PAPER : NAVY}`,
                )}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 13, marginBottom: 14 }}>
                  <Sym name={m.icon} size={24} color={on ? BRASS : SLATE} />
                  <span
                    style={{
                      marginInlineStart: "auto",
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: "0.14em",
                      color: on ? "rgba(245,243,239,0.5)" : "rgba(22,35,58,0.35)",
                    }}
                  >
                    {m.num}
                  </span>
                </div>
                <div style={S("font-family:Spectral,Georgia,serif;font-size:22px;font-weight:400;margin-bottom:9px")}>
                  {m.name}
                </div>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 300,
                    lineHeight: 1.62,
                    color: on ? "rgba(245,243,239,0.75)" : "rgba(22,35,58,0.7)",
                    marginBottom: 16,
                  }}
                >
                  {m.body}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {m.tags.map((t) => (
                    <span
                      key={t}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "4px 9px",
                        fontSize: 10.5,
                        fontWeight: 500,
                        letterSpacing: "0.04em",
                        background: on ? "rgba(245,243,239,0.12)" : "rgba(22,35,58,0.06)",
                        color: on ? "rgba(245,243,239,0.85)" : "rgba(22,35,58,0.65)",
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Features / showcase ─────────────────────────────── */}
      <div id="features" data-reveal="1" style={S(`background:#16233A;color:#F5F3EF;${SECTION_STYLE}`)}>
        <div style={S("max-width:1280px;margin:0 auto;padding:clamp(56px,7vw,100px) clamp(20px,4vw,48px)")}>
          <div
            style={S(
              "display:flex;flex-wrap:wrap;gap:24px;align-items:flex-end;margin-bottom:clamp(28px,3.5vw,40px)",
            )}
          >
            <div style={{ flex: "1 1 420px" }}>
              <div style={S(EYEBROW)}>Product</div>
              <h2 style={S(H2)}>Built around how law firms actually work.</h2>
            </div>
            <p
              style={S(
                "flex:1 1 280px;font-size:14.5px;font-weight:300;line-height:1.68;color:rgba(245,243,239,0.72);margin:0;max-width:44ch",
              )}
            >
              Seven views from the working product. Every figure, court and case name below is representative
              firm data.
            </p>
          </div>

          <div style={S("display:flex;flex-wrap:wrap;gap:8px;margin-bottom:clamp(20px,2.5vw,28px)")}>
            {SHOT_ORDER.map((k) => {
              const on = k === shot;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setShot(k)}
                  style={S(
                    `padding:10px 16px;font-size:11.5px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;cursor:pointer;transition:all .2s ease;font-family:inherit;${
                      on
                        ? "background:" + BRASS + ";color:" + NAVY + ";border:1px solid " + BRASS
                        : "background:transparent;border:1px solid rgba(245,243,239,0.28);color:rgba(245,243,239,0.78)"
                    }`,
                  )}
                >
                  {SHOTS[k].label}
                </button>
              );
            })}
          </div>

          <div style={S("background:#FAF9F6;color:#16233A;border:1px solid rgba(245,243,239,0.18)")}>
            <div
              style={S(
                "display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid rgba(22,35,58,0.12)",
              )}
            >
              <div style={{ minWidth: 0 }}>
                <div style={S("font-family:Spectral,Georgia,serif;font-size:19px;font-weight:400")}>{s.title}</div>
                <div style={{ fontSize: 11.5, fontWeight: 400, color: "rgba(22,35,58,0.6)", marginTop: 2 }}>{s.meta}</div>
              </div>
              <div style={{ marginInlineStart: "auto", display: "flex", flexWrap: "wrap", gap: 8 }}>
                {s.actions.map((act) => (
                  <span key={act[0]} style={S(actionStyle(act[1]))}>
                    {act[0]}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap" }}>
              <div style={S("flex:1 1 520px;min-width:min(100%,300px);overflow-x:auto")}>
                <div style={{ minWidth: 920 }}>
                  <div
                    style={S(
                      "display:flex;gap:12px;padding:9px 16px;background:#F5F3EF;border-bottom:1px solid rgba(22,35,58,0.12)",
                    )}
                  >
                    {s.cols.map((c) => (
                      <span key={c[0]} style={S(head(c[1]))}>
                        {c[0]}
                      </span>
                    ))}
                  </div>
                  {s.rows.map((r, ri) => (
                    <div
                      key={ri}
                      className="mz-rowhover"
                      style={S(
                        "display:flex;gap:12px;padding:12px 16px;border-bottom:1px solid rgba(22,35,58,0.08);align-items:center",
                      )}
                    >
                      {r.map((c, ci) => {
                        const { text, style } = shotCellStyle(c);
                        return (
                          <span key={ci} style={S(style)}>
                            {text}
                          </span>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <div style={S("flex:1 1 260px;min-width:min(100%,240px);border-inline-start:1px solid rgba(22,35,58,0.12);background:#F5F3EF")}>
                <div
                  style={S(
                    "padding:14px 16px;border-bottom:1px solid rgba(22,35,58,0.12);font-size:10.5px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#31456B",
                  )}
                >
                  {s.asideTitle}
                </div>
                <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
                  {s.aside.map(([k, v]) => (
                    <div key={k}>
                      <div
                        style={S(
                          "font-size:10px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:rgba(22,35,58,0.5);margin-bottom:4px",
                        )}
                      >
                        {k}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.5 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── AI ──────────────────────────────────────────────── */}
      <div id="ai" data-reveal="1" style={S(`max-width:1280px;margin:0 auto;padding:clamp(56px,7vw,100px) clamp(20px,4vw,48px);${SECTION_STYLE}`)}>
        <div style={S("max-width:66ch;margin-bottom:clamp(36px,4.5vw,52px)")}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
            <Sym name="auto_awesome" size={18} color={BRASS} />
            <span style={S("font-size:10.5px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:#B99A5B")}>
              Mizan AI
            </span>
          </div>
          <h2 style={S(`${H2};margin:0 0 18px`)}>Your firm&rsquo;s data. Now easier to work with.</h2>
          <p
            style={S(
              "font-size:clamp(14.5px,1.15vw,16.5px);font-weight:300;line-height:1.68;color:rgba(22,35,58,0.72);margin:0;text-wrap:pretty",
            )}
          >
            Mizan&rsquo;s assistant is not a chat window bolted onto a dashboard. It reads and acts through the
            same system capabilities your staff use, inside the same authorization boundaries, and it asks
            before it changes anything.
          </p>
        </div>

        <div style={S("display:flex;flex-wrap:wrap;gap:clamp(20px,3vw,32px);align-items:stretch")}>
          <div style={S("flex:1 1 340px;min-width:min(100%,300px);display:flex;flex-direction:column;gap:12px")}>
            <div style={S("font-size:10.5px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#31456B")}>
              Ask about the file
            </div>
            {AI_ORDER.map((k) => {
              const on = k === ai;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => askAi(k)}
                  style={S(
                    `display:flex;align-items:center;gap:13px;padding:15px 16px;cursor:pointer;transition:all .2s ease;text-align:start;font-family:inherit;width:100%;${
                      on
                        ? "background:" + NAVY + ";color:" + PAPER + ";border:1px solid " + NAVY
                        : "background:" + CARD + ";border:1px solid rgba(22,35,58,0.14);color:" + NAVY
                    }`,
                  )}
                >
                  <Sym name={AI[k].icon} size={18} color={on ? BRASS : SLATE} />
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, lineHeight: 1.45 }}>{AI[k].label}</span>
                  <Sym name="arrow_forward" size={17} color={on ? BRASS : "rgba(22,35,58,0.25)"} />
                </button>
              );
            })}

            <div style={S("margin-top:6px;border:1px solid rgba(22,35,58,0.14);padding:clamp(16px,2vw,20px);background:#FAF9F6")}>
              <div
                style={S(
                  "font-size:10.5px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#31456B;margin-bottom:14px",
                )}
              >
                How a request is answered
              </div>
              {AI_CHAIN.map((c, i) => (
                <div key={c.title} style={{ display: "flex", gap: 12, alignItems: "flex-start", paddingBottom: 12 }}>
                  <div style={{ width: 22, flex: "0 0 22px", display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 9, height: 9, flex: "0 0 9px", marginTop: 5, background: i === 0 ? SLATE : BRASS }} />
                    <span
                      style={{
                        width: 1,
                        flex: 1,
                        minHeight: i === AI_CHAIN.length - 1 ? 0 : 18,
                        background: "rgba(22,35,58,0.18)",
                      }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{c.title}</div>
                    <div style={{ fontSize: 12, fontWeight: 300, lineHeight: 1.55, color: "rgba(22,35,58,0.65)", marginTop: 2 }}>
                      {c.body}
                    </div>
                  </div>
                </div>
              ))}
              <div
                style={S(
                  "display:flex;gap:10px;align-items:flex-start;border-top:1px solid rgba(22,35,58,0.12);padding-top:14px;margin-top:2px",
                )}
              >
                <Sym name="lock" size={18} color={SLATE} />
                <div style={{ fontSize: 12, fontWeight: 400, lineHeight: 1.55, color: "rgba(22,35,58,0.72)" }}>
                  <span style={{ fontWeight: 600, color: NAVY }}>AI doesn&rsquo;t bypass your firm&rsquo;s permissions.</span>{" "}
                  If a user cannot open a matter, the assistant cannot read it on their behalf.
                </div>
              </div>
            </div>
          </div>

          <div style={S("flex:1 1 440px;min-width:min(100%,300px)")}>
            <div style={S("border:1px solid rgba(22,35,58,0.14);background:#FAF9F6;height:100%;display:flex;flex-direction:column")}>
              <div
                style={S(
                  "display:flex;align-items:center;gap:10px;padding:13px 16px;border-bottom:1px solid rgba(22,35,58,0.12);background:#16233A",
                )}
              >
                <span
                  style={S(
                    "width:22px;height:22px;border-radius:9999px;background:radial-gradient(circle at 30% 26%,#31456B,#16233A);border:1px solid rgba(185,154,91,0.6)",
                  )}
                />
                <span style={S("font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:rgba(245,243,239,0.85)")}>
                  Ask Mizan
                </span>
                <span
                  style={S(
                    "margin-inline-start:auto;font-size:10px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:rgba(245,243,239,0.55)",
                  )}
                >
                  {a.scope}
                </span>
              </div>

              <div style={S("padding:clamp(16px,2vw,22px);display:flex;flex-direction:column;gap:16px;flex:1")}>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div
                    style={S(
                      "max-width:86%;background:#16233A;color:#F5F3EF;padding:11px 15px;font-size:13px;font-weight:400;line-height:1.5",
                    )}
                  >
                    {a.question}
                  </div>
                </div>

                {thinking && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={S(
                        "width:22px;height:22px;border-radius:9999px;background:radial-gradient(circle at 30% 26%,#31456B,#16233A)",
                      )}
                    />
                    <span
                      style={S(
                        "font-size:12px;font-weight:400;color:rgba(22,35,58,0.6);animation:mzPulse 1.2s ease-in-out infinite",
                      )}
                    >
                      Reading the matter file…
                    </span>
                  </div>
                )}

                {answered && (
                  <div style={S("display:flex;gap:12px;animation:mzIn .4s ease-out both")}>
                    <span
                      style={S(
                        "width:22px;height:22px;flex:0 0 22px;border-radius:9999px;background:radial-gradient(circle at 30% 26%,#31456B,#16233A)",
                      )}
                    />
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 13 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 400,
                          lineHeight: 1.65,
                          color: "rgba(22,35,58,0.85)",
                          whiteSpace: "pre-line",
                        }}
                      >
                        {a.answer}
                      </div>

                      {hasRows && (
                        <div style={S("border:1px solid rgba(22,35,58,0.14)")}>
                          {a.rows!.map((r, i) => (
                            <div
                              key={i}
                              style={S(
                                "display:flex;align-items:center;gap:12px;padding:11px 13px;border-bottom:1px solid rgba(22,35,58,0.08)",
                              )}
                            >
                              <div style={S("width:36px;flex:0 0 36px;text-align:center;border-inline-end:1px solid rgba(22,35,58,0.12)")}>
                                <div style={S("font-size:9px;font-weight:600;letter-spacing:0.14em;color:#B99A5B")}>{r.mon}</div>
                                <div style={S("font-family:Spectral,Georgia,serif;font-size:15px;font-weight:400;line-height:1.1")}>
                                  {r.day}
                                </div>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12.5, fontWeight: 500 }}>{r.title}</div>
                                <div style={{ fontSize: 10.5, color: "rgba(22,35,58,0.55)", marginTop: 2 }}>{r.meta}</div>
                              </div>
                              <span style={S(pill(r.tone))}>{r.tag}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                        <span
                          style={S(
                            "display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border:1px solid rgba(22,35,58,0.2);font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#16233A",
                          )}
                        >
                          <Sym name="source" size={15} />
                          {a.source}
                        </span>
                        <span style={{ fontSize: 11.5, fontWeight: 400, color: "rgba(22,35,58,0.55)" }}>
                          Drawn from records this user can already open.
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div style={S("padding:0 clamp(16px,2vw,22px) clamp(16px,2vw,22px)")}>
                <div
                  style={S(
                    "display:flex;align-items:center;gap:10px;border:1px solid rgba(22,35,58,0.2);padding:12px 14px;background:#F5F3EF",
                  )}
                >
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 400, color: "rgba(22,35,58,0.45)" }}>
                    Ask about a matter, client or your schedule…
                  </span>
                  <Sym name="send" size={18} color={SLATE} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Documents ───────────────────────────────────────── */}
      <div data-reveal="1" style={S("border-top:1px solid rgba(22,35,58,0.12);background:#FAF9F6")}>
        <div style={S("max-width:1280px;margin:0 auto;padding:clamp(56px,7vw,100px) clamp(20px,4vw,48px)")}>
          <div style={S("display:flex;flex-wrap:wrap;gap:24px;align-items:flex-end;margin-bottom:clamp(32px,4vw,44px)")}>
            <div style={{ flex: "1 1 420px" }}>
              <div style={S(EYEBROW)}>Documents</div>
              <h2 style={S(H2)}>Every document, exactly where it belongs.</h2>
            </div>
            <p
              style={S(
                "flex:1 1 280px;font-size:14.5px;font-weight:300;line-height:1.68;color:rgba(22,35,58,0.72);margin:0;max-width:44ch",
              )}
            >
              Filed against the matter, not a folder path. Preview, version history, category and review state
              travel with the document.
            </p>
          </div>

          <div style={S("display:flex;flex-wrap:wrap;border:1px solid rgba(22,35,58,0.14);background:#F5F3EF")}>
            <div style={S("flex:1 1 300px;min-width:min(100%,260px);border-inline-end:1px solid rgba(22,35,58,0.12)")}>
              <div style={S("display:flex;align-items:center;gap:10px;padding:13px 15px;border-bottom:1px solid rgba(22,35,58,0.12)")}>
                <Sym name="search" size={18} color="rgba(22,35,58,0.5)" />
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: 400, color: "rgba(22,35,58,0.5)" }}>
                  Search 1,284 documents
                </span>
                <Sym name="filter_list" size={18} color={SLATE} />
              </div>
              <div style={S("display:flex;flex-wrap:wrap;gap:6px;padding:12px 15px;border-bottom:1px solid rgba(22,35,58,0.12)")}>
                {DOC_CATS.map(([label, active]) => (
                  <span
                    key={label}
                    style={S(
                      `display:inline-flex;align-items:center;padding:5px 11px;font-size:11px;font-weight:500;letter-spacing:0.04em;cursor:pointer;${
                        active
                          ? "background:" + NAVY + ";color:" + PAPER
                          : "border:1px solid rgba(22,35,58,0.18);color:rgba(22,35,58,0.65)"
                      }`,
                    )}
                  >
                    {label}
                  </span>
                ))}
              </div>
              {DOCS.map((d, i) => {
                const on = i === docIdx;
                return (
                  <button
                    key={d.name}
                    type="button"
                    onClick={() => setDocIdx(i)}
                    style={S(
                      `display:flex;align-items:center;gap:12px;padding:13px 15px;border-bottom:1px solid rgba(22,35,58,0.08);cursor:pointer;transition:background .2s ease;width:100%;text-align:start;font-family:inherit;${
                        on ? "background:" + CARD + ";box-shadow:inset 3px 0 0 " + BRASS : "background:transparent"
                      }`,
                    )}
                  >
                    <Sym name="description" size={20} color={on ? BRASS : "rgba(22,35,58,0.4)"} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S("font-size:12.5px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>
                        {d.name}
                      </div>
                      <div style={{ fontSize: 10.5, fontWeight: 400, color: "rgba(22,35,58,0.55)", marginTop: 2 }}>{d.meta}</div>
                    </div>
                    <span style={S(pill(d.tone))}>{d.st}</span>
                  </button>
                );
              })}
            </div>

            <div style={S("flex:1 1 360px;min-width:min(100%,280px);display:flex;flex-direction:column")}>
              <div
                style={S(
                  "display:flex;align-items:center;gap:10px;padding:13px 15px;border-bottom:1px solid rgba(22,35,58,0.12);background:#FAF9F6",
                )}
              >
                <span
                  style={S(
                    "font-size:12.5px;font-weight:600;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis",
                  )}
                >
                  {doc.name}
                </span>
                <Sym name="download" size={18} color={SLATE} />
                <Sym name="open_in_full" size={18} color={SLATE} />
              </div>
              <div
                style={S(
                  "flex:1;padding:clamp(16px,2.4vw,26px);display:flex;align-items:center;justify-content:center;background:repeating-linear-gradient(135deg,#F5F3EF,#F5F3EF 8px,rgba(22,35,58,0.05) 8px,rgba(22,35,58,0.05) 16px);min-height:230px",
                )}
              >
                <div
                  style={S(
                    "width:min(100%,258px);background:#FAF9F6;border:1px solid rgba(22,35,58,0.16);box-shadow:0 18px 40px -22px rgba(22,35,58,0.4);padding:22px 20px",
                  )}
                >
                  <div
                    style={S(
                      "font-family:Spectral,Georgia,serif;font-size:12px;font-weight:400;text-align:center;letter-spacing:0.08em;text-transform:uppercase;color:#31456B;padding-bottom:10px;border-bottom:1px solid rgba(22,35,58,0.16)",
                    )}
                  >
                    {doc.court}
                  </div>
                  <div
                    style={S(
                      "font-family:Spectral,Georgia,serif;font-size:14.5px;font-weight:400;line-height:1.45;margin:14px 0 12px;text-align:center",
                    )}
                  >
                    {doc.heading}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[96, 88, 100, 74, 92, 62, 84].map((w, i) => (
                      <span
                        key={i}
                        style={{
                          display: "block",
                          height: 5,
                          width: `${w}%`,
                          background: `rgba(22,35,58,${i % 3 === 0 ? "0.16" : "0.1"})`,
                        }}
                      />
                    ))}
                  </div>
                  <div
                    style={S(
                      "margin-top:16px;padding-top:10px;border-top:1px solid rgba(22,35,58,0.16);display:flex;justify-content:space-between;font-size:9.5px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;color:rgba(22,35,58,0.5)",
                    )}
                  >
                    <span>{doc.ref}</span>
                    <span>{doc.page}</span>
                  </div>
                </div>
              </div>
              <div
                style={S(
                  "border-top:1px solid rgba(22,35,58,0.12);display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:1px;background:rgba(22,35,58,0.12)",
                )}
              >
                {doc.metaRows.map(([k, v]) => (
                  <div key={k} style={{ background: PAPER, padding: "11px 14px" }}>
                    <div
                      style={S(
                        "font-size:9.5px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:rgba(22,35,58,0.5)",
                      )}
                    >
                      {k}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500, marginTop: 3 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Workflow ────────────────────────────────────────── */}
      <div data-reveal="1" style={S("max-width:1280px;margin:0 auto;padding:clamp(56px,7vw,100px) clamp(20px,4vw,48px)")}>
        <div style={S("max-width:60ch;margin-bottom:clamp(34px,4.5vw,48px)")}>
          <div style={S(EYEBROW)}>Workflow</div>
          <h2 style={S(`${H2};margin:0 0 18px`)}>From legal work to organized workflow.</h2>
          <p style={S("font-size:15px;font-weight:300;line-height:1.68;color:rgba(22,35,58,0.72);margin:0")}>
            One matter, seven stages. Select a stage to see what the system carries at that point.
          </p>
        </div>

        <div
          style={S(
            "display:flex;flex-wrap:wrap;gap:1px;background:rgba(22,35,58,0.14);border:1px solid rgba(22,35,58,0.14);margin-bottom:clamp(20px,2.5vw,28px)",
          )}
        >
          {FLOW.map((f, i) => {
            const on = i === flow;
            return (
              <button
                key={f.label}
                type="button"
                onClick={() => setFlow(i)}
                style={S(
                  `flex:1 1 130px;min-width:118px;display:flex;flex-direction:column;gap:9px;padding:clamp(14px,1.8vw,20px) clamp(12px,1.6vw,18px);cursor:pointer;transition:all .25s ease;text-align:start;font-family:inherit;${
                    on ? "background:" + NAVY + ";color:" + PAPER : "background:" + CARD + ";color:" + NAVY
                  }`,
                )}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.16em",
                    color: on ? "rgba(245,243,239,0.55)" : "rgba(22,35,58,0.35)",
                  }}
                >
                  {f.num}
                </span>
                <Sym name={f.icon} size={21} color={on ? BRASS : SLATE} />
                <span style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: "0.02em" }}>{f.label}</span>
              </button>
            );
          })}
        </div>

        <div style={S("border:1px solid rgba(22,35,58,0.14);background:#FAF9F6;display:flex;flex-wrap:wrap")}>
          <div style={S("flex:1 1 380px;min-width:min(100%,280px);padding:clamp(20px,2.8vw,30px)")}>
            <div
              style={S(
                "font-size:10.5px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#B99A5B;margin-bottom:12px",
              )}
            >
              Stage {stage.num} · {stage.label}
            </div>
            <div
              style={S(
                "font-family:Spectral,Georgia,serif;font-size:clamp(21px,2.4vw,27px);font-weight:400;line-height:1.32;margin-bottom:14px",
              )}
            >
              {stage.headline}
            </div>
            <div style={S("font-size:14px;font-weight:300;line-height:1.68;color:rgba(22,35,58,0.72);text-wrap:pretty")}>
              {stage.body}
            </div>
          </div>
          <div style={S("flex:1 1 300px;min-width:min(100%,260px);border-inline-start:1px solid rgba(22,35,58,0.12);background:#F5F3EF")}>
            <div
              style={S(
                "padding:14px 16px;border-bottom:1px solid rgba(22,35,58,0.12);font-size:10.5px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#31456B",
              )}
            >
              Recorded at this stage
            </div>
            {stage.items.map(([k, v]) => (
              <div
                key={k}
                style={S(
                  "display:flex;align-items:center;gap:11px;padding:12px 16px;border-bottom:1px solid rgba(22,35,58,0.08)",
                )}
              >
                <span style={{ width: 5, height: 5, background: BRASS }} />
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500 }}>{k}</span>
                <span style={{ fontSize: 11.5, fontWeight: 400, color: "rgba(22,35,58,0.6)", textAlign: "end" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Security ────────────────────────────────────────── */}
      <div id="security" data-reveal="1" style={S(`background:#16233A;color:#F5F3EF;${SECTION_STYLE}`)}>
        <div style={S("max-width:1280px;margin:0 auto;padding:clamp(56px,7vw,100px) clamp(20px,4vw,48px)")}>
          <div
            style={S(
              "display:flex;flex-wrap:wrap;gap:clamp(24px,4vw,60px);align-items:flex-end;margin-bottom:clamp(34px,4.5vw,50px)",
            )}
          >
            <div style={{ flex: "1 1 420px" }}>
              <div style={S(EYEBROW)}>Security</div>
              <h2 style={S(H2)}>Built for sensitive legal work.</h2>
            </div>
            <p
              style={S(
                "flex:1 1 300px;font-size:14.5px;font-weight:300;line-height:1.68;color:rgba(245,243,239,0.72);margin:0;max-width:46ch",
              )}
            >
              Security sits in the architecture rather than in a feature list. Access is decided per role and
              per organization, every read and write is attributable, and the assistant inherits the same rules
              as the user behind it.
            </p>
          </div>

          <div
            style={S(
              "display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:1px;background:rgba(245,243,239,0.2);border:1px solid rgba(245,243,239,0.2)",
            )}
          >
            {SECURITY.map((sec) => (
              <div key={sec.title} style={S("background:#16233A;padding:clamp(18px,2.2vw,26px)")}>
                <Sym name={sec.icon} size={22} color={BRASS} />
                <div style={{ fontSize: 15, fontWeight: 600, margin: "12px 0 8px", letterSpacing: "0.01em" }}>{sec.title}</div>
                <div style={{ fontSize: 13, fontWeight: 300, lineHeight: 1.6, color: "rgba(245,243,239,0.72)" }}>{sec.body}</div>
                <div
                  style={S(
                    "font-size:10px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:rgba(245,243,239,0.45);margin-top:14px;padding-top:12px;border-top:1px solid rgba(245,243,239,0.16)",
                  )}
                >
                  {sec.tech}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── About ───────────────────────────────────────────── */}
      <div id="about" data-reveal="1" style={S(`max-width:1280px;margin:0 auto;padding:clamp(56px,7vw,100px) clamp(20px,4vw,48px);${SECTION_STYLE}`)}>
        <div style={S("max-width:60ch;margin-bottom:clamp(34px,4.5vw,48px)")}>
          <div style={S(EYEBROW)}>Why Mizan</div>
          <h2 style={S(H2)}>Stop managing your firm across disconnected tools.</h2>
        </div>

        <div style={S("display:flex;flex-wrap:wrap;gap:1px;background:rgba(22,35,58,0.14);border:1px solid rgba(22,35,58,0.14)")}>
          <div style={S("flex:1 1 330px;min-width:min(100%,280px);background:#F5F3EF;padding:clamp(20px,2.6vw,30px)")}>
            <div
              style={S(
                "font-size:10px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:rgba(22,35,58,0.5);margin-bottom:18px",
              )}
            >
              Today, in most firms
            </div>
            {BEFORE.map(([k, v]) => (
              <div
                key={k}
                style={S(
                  "display:flex;align-items:flex-start;gap:12px;padding:11px 0;border-bottom:1px solid rgba(22,35,58,0.1)",
                )}
              >
                <Sym name="close" size={17} color="rgba(22,35,58,0.4)" style={{ marginTop: 1 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "rgba(22,35,58,0.8)" }}>{k}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 300, color: "rgba(22,35,58,0.55)", marginTop: 2 }}>{v}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={S("flex:1 1 330px;min-width:min(100%,280px);background:#16233A;color:#F5F3EF;padding:clamp(20px,2.6vw,30px)")}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <Mark size={18} stroke={PAPER} dot={false} />
              <span style={S("font-size:10px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#B99A5B")}>
                With Mizan
              </span>
            </div>
            {AFTER.map(([k, v]) => (
              <div
                key={k}
                style={S(
                  "display:flex;align-items:flex-start;gap:12px;padding:11px 0;border-bottom:1px solid rgba(245,243,239,0.16)",
                )}
              >
                <Sym name="check" size={17} color={BRASS} style={{ marginTop: 1 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{k}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 300, color: "rgba(245,243,239,0.7)", marginTop: 2 }}>{v}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Demo CTA ────────────────────────────────────────── */}
      <div id="demo" data-reveal="1" style={S(`border-top:1px solid rgba(22,35,58,0.12);background:#FAF9F6;${SECTION_STYLE}`)}>
        <div style={S("max-width:1280px;margin:0 auto;padding:clamp(64px,8vw,120px) clamp(20px,4vw,48px);text-align:center")}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 26 }}>
            <svg width="42" height="42" viewBox="0 0 100 100" fill="none" stroke="#16233A" strokeWidth={4} strokeLinecap="round" aria-hidden>
              <path d="M50 26 V 78" />
              <path d="M36 81 H 64" />
              <path d="M16 32 H 84" />
              <path d="M16 32 V 42" />
              <path d="M84 32 V 42" />
              <circle cx="16" cy="53" r="11" />
              <circle cx="84" cy="53" r="11" />
              <circle cx="50" cy="22" r="4.5" fill="#B99A5B" stroke="none" />
            </svg>
          </div>
          <h2
            style={S(
              "font-family:Spectral,Georgia,serif;font-size:clamp(32px,4.6vw,58px);font-weight:400;line-height:1.08;margin:0 auto 20px;max-width:22ch;text-wrap:balance",
            )}
          >
            Give your firm a better way to work.
          </h2>
          <p
            style={S(
              "font-size:clamp(14.5px,1.2vw,17px);font-weight:300;line-height:1.66;color:rgba(22,35,58,0.72);margin:0 auto 34px;max-width:52ch;text-wrap:pretty",
            )}
          >
            Bring your matters, people, documents, workflows, and intelligence into one system.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            <a
              href={DEMO_HREF}
              className="mz-cta-navy"
              style={S(
                "display:inline-flex;align-items:center;gap:9px;padding:16px 30px;background:#16233A;color:#F5F3EF;font-size:11.5px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase",
              )}
            >
              Request a demo
              <Sym name="arrow_forward" size={17} />
            </a>
            <a
              href="#platform"
              className="mz-cta-outline"
              style={S(
                "display:inline-flex;align-items:center;padding:16px 30px;border:1px solid rgba(22,35,58,0.28);color:#16233A;font-size:11.5px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase",
              )}
            >
              Explore Mizan
            </a>
          </div>
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────── */}
      <div style={{ background: NAVY, color: PAPER }}>
        <div style={S("max-width:1280px;margin:0 auto;padding:clamp(38px,5vw,56px) clamp(20px,4vw,48px)")}>
          <div style={S("display:flex;flex-wrap:wrap;gap:clamp(24px,4vw,56px);align-items:flex-start")}>
            <div style={{ flex: "1 1 260px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
                <Mark size={24} stroke={PAPER} />
                <span style={S("font-family:Spectral,Georgia,serif;font-size:20px;font-weight:400;letter-spacing:0.02em")}>
                  Mizan
                </span>
              </div>
              <div style={S("font-size:12.5px;font-weight:300;line-height:1.6;color:rgba(245,243,239,0.66);max-width:34ch")}>
                Practice management for law firms. Matters, clients, documents, hearings, tasks and billing in
                one system.
              </div>
            </div>
            {(
              [
                ["Product", [["#platform", "Platform"], ["#features", "Features"], ["#ai", "Mizan AI"], ["#security", "Security"]]],
                ["Firm", [["#about", "About"], [DEMO_HREF, "Request a demo"], ["/login", "Sign in"]]],
              ] as [string, [string, string][]][]
            ).map(([title, links]) => (
              <div key={title} style={{ flex: "0 1 150px" }}>
                <div style={S("font-size:10px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#B99A5B;margin-bottom:12px")}>
                  {title}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {links.map(([href, label]) =>
                    href.startsWith("/") ? (
                      <Link key={label} to={href} style={{ fontSize: 12.5, fontWeight: 400, color: "rgba(245,243,239,0.78)" }}>
                        {label}
                      </Link>
                    ) : (
                      <a key={label} href={href} style={{ fontSize: 12.5, fontWeight: 400, color: "rgba(245,243,239,0.78)" }}>
                        {label}
                      </a>
                    ),
                  )}
                </div>
              </div>
            ))}
            <div style={{ flex: "0 1 190px" }}>
              <div style={S("font-size:10px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#B99A5B;margin-bottom:12px")}>
                Contact
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <span style={{ fontSize: 12.5, fontWeight: 400, color: "rgba(245,243,239,0.78)" }}>hello@mizan.legal</span>
                <span style={{ fontSize: 12.5, fontWeight: 400, color: "rgba(245,243,239,0.78)" }}>Cairo · Abu Dhabi</span>
                <span style={{ fontSize: 12.5, fontWeight: 400, color: "rgba(245,243,239,0.78)" }}>العربية</span>
              </div>
            </div>
          </div>
          <div
            style={S(
              "display:flex;flex-wrap:wrap;gap:14px;align-items:center;margin-top:clamp(28px,3.5vw,40px);padding-top:20px;border-top:1px solid rgba(245,243,239,0.16)",
            )}
          >
            <span style={{ fontSize: 11.5, fontWeight: 400, color: "rgba(245,243,239,0.5)" }}>
              © 2026 Mizan. All rights reserved.
            </span>
            <span style={{ marginInlineStart: "auto", fontSize: 11.5, fontWeight: 400, color: "rgba(245,243,239,0.5)" }}>
              Privacy · Terms · Data processing
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
