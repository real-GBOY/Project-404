import { C } from "@/styles/colors";
import { FONT } from "@/styles/typography";
import { CTA_TO } from "./chrome";
import type { Copy } from "./copy-types";
import { AnswerRow, Band, cell, Eyebrow, H2, Heading, Ltr, Points, tone, type Layout } from "./ui";
import { Link } from "react-router-dom";

export function Roles({ c, L }: { c: Copy; L: Layout }) {
  return (
    <Band id="roles" L={L} gap={32}>
      <Heading L={L} eyebrow={c.rolesEyebrow} title={c.rolesTitle} body={c.rolesBody} />
      <div style={{ borderTop: `1px solid ${C.text.ink}` }}>
        {c.roles.map((r, i) => (
          <div
            key={cell(r, 0)}
            style={{
              display: "grid",
              gridTemplateColumns: L.roleCols,
              gap: "6px 28px",
              padding: "18px 0",
              borderBottom: `1px solid ${C.border.hairline}`,
              alignItems: "baseline",
            }}
          >
            <span style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
              <Ltr style={{ fontSize: 12, color: C.text.muted }}>{`0${i + 1}`}</Ltr>
              <span style={{ fontWeight: 700, fontSize: 17 }}>{cell(r, 0)}</span>
            </span>
            <span style={{ fontSize: 15, color: C.text.body, textWrap: "pretty" }}>
              {cell(r, 1)}
            </span>
            <span style={{ fontSize: 12.5, color: C.text.secondary }}>{cell(r, 2)}</span>
          </div>
        ))}
      </div>
    </Band>
  );
}

/** Traceability, on the dark band: finding → evidence → record → report, then the corrective-action path. */
export function Records({ c, L }: { c: Copy; L: Layout }) {
  const accent = C.chrome.accentLight;
  return (
    <Band id="records" L={L} bg={C.text.ink} color={C.surface.canvas} gap={36}>
      <Heading
        L={L}
        eyebrow={c.recEyebrow}
        title={c.recTitle}
        body={c.recBody}
        eyebrowColor={accent}
        bodyColor={C.chrome.textStrong}
        max={780}
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,240px),1fr))",
          gap: 12,
        }}
      >
        {c.chain.map((k, i) => (
          <div
            key={k.ref + i}
            style={{
              background: C.surface.white,
              color: C.text.ink,
              borderRadius: 6,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                alignItems: "center",
              }}
            >
              <span
                style={{ fontSize: 12, color: C.text.secondary }}
              >{`0${i + 1} · ${k.step}`}</span>
              <span aria-hidden style={{ color: C.brand.primary, fontWeight: 700 }}>
                {i < 3 ? (L.mob ? "↓" : "→") : ""}
              </span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{k.title}</div>
            <Ltr
              style={{
                display: "block",
                fontSize: 12.5,
                color: C.brand.primary,
                textAlign: "start",
              }}
            >
              {k.ref}
            </Ltr>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 5,
                borderTop: `1px solid ${C.surface.track}`,
                paddingTop: 8,
              }}
            >
              {k.lines.map((l) => (
                <div
                  key={cell(l, 0)}
                  style={{ display: "flex", gap: 8, fontSize: 12.5, alignItems: "baseline" }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: tone(cell(l, 2))[0],
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1, color: C.text.body }}>{cell(l, 0)}</span>
                  <span style={{ color: C.text.muted, fontSize: 11.5, whiteSpace: "nowrap" }}>
                    {cell(l, 1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          border: `1px solid ${C.chrome.lineAlt}`,
          borderRadius: 6,
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div
          style={{ display: "flex", gap: "10px 16px", flexWrap: "wrap", alignItems: "baseline" }}
        >
          <Ltr style={{ fontSize: 12.5, color: accent }}>CA-26-0118</Ltr>
          <span style={{ fontWeight: 600 }}>{c.caT}</span>
          <span style={{ fontSize: 13, color: C.chrome.textMuted }}>{c.caSub}</span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))",
            gap: 6,
          }}
        >
          {c.caSteps.map((label, i) => (
            <div key={label}>
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: i < 4 ? accent : i === 4 ? C.status.warning.mark : C.chrome.lineAlt,
                }}
              />
              <div
                style={{
                  fontSize: 12.5,
                  marginTop: 6,
                  color: i <= 4 ? C.surface.canvas : C.text.muted,
                  fontWeight: i === 4 ? 600 : 500,
                }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Band>
  );
}

/** Arabic and English side by side, each in its own direction. */
export function Bilingual({ c, L }: { c: Copy; L: Layout }) {
  const card: React.CSSProperties = {
    border: `1px solid ${C.border.hairline}`,
    borderRadius: 6,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 9,
    fontFamily: FONT.sans,
    background: C.surface.paper,
  };
  const head = (label: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 11.5, color: C.text.secondary }}>{label}</span>
      <Ltr style={{ fontSize: 11, color: C.text.muted }}>VIS-26-0409</Ltr>
    </div>
  );
  return (
    <Band
      id="language"
      L={L}
      bg={C.surface.white}
      inner={{
        display: "grid",
        gridTemplateColumns: L.probCols,
        gap: "40px 64px",
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Eyebrow>{c.langEyebrow}</Eyebrow>
        <H2 L={L}>{c.langTitle}</H2>
        <p style={{ margin: 0, fontSize: 16, color: C.text.body, textWrap: "pretty" }}>
          {c.langBody}
        </p>
        <Points items={c.langPoints} />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,240px),1fr))",
          gap: 12,
        }}
      >
        <div dir="rtl" lang="ar" style={card}>
          {head("العربية · من اليمين لليسار")}
          <div style={{ fontWeight: 600, fontSize: 14.5 }}>التحقق من هوية الزوار مقابل السجل</div>
          <AnswerRow labels={["مطابق", "غير مطابق", "لا ينطبق"]} pick={1} height={36} size={12.5} />
          <div style={{ fontSize: 12, color: C.text.secondary }}>
            الأحد 4 أكتوبر 2026 · <span dir="ltr">07:40</span> · الوزن 3
          </div>
        </div>
        <div dir="ltr" lang="en" style={card}>
          {head("English · left to right")}
          <div style={{ fontWeight: 600, fontSize: 14.5 }}>
            Visitor ID verified against the register
          </div>
          <AnswerRow
            labels={["Compliant", "Non-compliant", "N/A"]}
            pick={1}
            height={36}
            size={12.5}
          />
          <div style={{ fontSize: 12, color: C.text.secondary }}>
            Sun 4 Oct 2026 · 07:40 · Weight 3
          </div>
        </div>
      </div>
    </Band>
  );
}

export function Cta({ c, L }: { c: Copy; L: Layout }) {
  return (
    <section
      id="contact"
      style={{ background: C.brand.primaryDark, color: C.surface.white, scrollMarginTop: 64 }}
    >
      <div
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          padding: `${L.secPad}px ${L.hpad}px`,
          display: "grid",
          gridTemplateColumns: L.probCols,
          gap: "28px 64px",
          alignItems: "end",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <H2 L={L}>{c.ctaTitle}</H2>
          <p
            style={{
              margin: 0,
              fontSize: 17,
              color: C.brand.onDark,
              maxWidth: 560,
              textWrap: "pretty",
            }}
          >
            {c.ctaBody}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link
            to={CTA_TO}
            style={{
              height: 54,
              borderRadius: 4,
              background: C.surface.white,
              color: C.brand.primaryDark,
              fontWeight: 600,
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
            }}
          >
            {c.tryDemo}
          </Link>
          <Link
            to={CTA_TO}
            style={{
              height: 54,
              border: `1px solid ${C.chrome.accentLight}`,
              borderRadius: 4,
              color: C.surface.white,
              fontWeight: 500,
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
            }}
          >
            {c.signIn}
          </Link>
          <div style={{ fontSize: 12.5, color: C.chrome.textMuted }}>{c.ctaMeta}</div>
        </div>
      </div>
    </section>
  );
}
