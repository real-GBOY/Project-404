import { C } from "@/styles/colors";
import { CTA_TO, goTo, PrimaryLink } from "./chrome";
import type { Copy } from "./copy-types";
import { HeroCard } from "./hero-card";
import { Band, cell, Eyebrow, H2, Ltr, type Layout } from "./ui";

export function Hero({ c, L }: { c: Copy; L: Layout }) {
  return (
    <section
      id="platform"
      style={{
        maxWidth: 1240,
        margin: "0 auto",
        padding: `${L.heroPad}px ${L.hpad}px 56px`,
        display: "grid",
        gridTemplateColumns: L.heroCols,
        gap: 48,
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
        <Eyebrow>{c.eyebrow}</Eyebrow>
        <h1
          style={{
            margin: 0,
            fontSize: L.h1,
            lineHeight: 1.12,
            fontWeight: 700,
            letterSpacing: "-.01em",
            textWrap: "balance",
          }}
        >
          {c.h1}
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 18,
            lineHeight: 1.65,
            color: C.text.body,
            maxWidth: 560,
            textWrap: "pretty",
          }}
        >
          {c.heroSub}
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
          <PrimaryLink to={CTA_TO}>{c.tryDemo}</PrimaryLink>
          <button
            type="button"
            onClick={() => goTo("how")}
            style={{
              height: 50,
              padding: "0 22px",
              border: `1px solid ${C.text.ink}`,
              borderRadius: 4,
              background: "transparent",
              color: C.text.ink,
              fontWeight: 500,
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            {c.explore}
          </button>
        </div>
        <div
          style={{
            fontSize: 13,
            color: C.text.secondary,
            borderTop: `1px solid ${C.border.hairline}`,
            paddingTop: 14,
            maxWidth: 560,
          }}
        >
          {c.heroMeta}
        </div>
      </div>
      <div style={{ minWidth: 0 }}>
        <HeroCard c={c} />
        <div style={{ fontSize: 12, color: C.text.muted, marginTop: 10, textAlign: "center" }}>
          {c.m.caption}
        </div>
      </div>
    </section>
  );
}

export function Problem({ c, L }: { c: Copy; L: Layout }) {
  return (
    <Band
      L={L}
      bg={C.surface.white}
      inner={{
        display: "grid",
        gridTemplateColumns: L.probCols,
        gap: "40px 64px",
        alignItems: "start",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Eyebrow color={C.text.muted}>{c.probEyebrow}</Eyebrow>
        <H2 L={L}>{c.probTitle}</H2>
        <p style={{ margin: 0, fontSize: 16.5, color: C.text.body, textWrap: "pretty" }}>
          {c.probBody}
        </p>
      </div>
      <ol
        style={{ listStyle: "none", margin: 0, padding: 0, borderTop: `1px solid ${C.text.ink}` }}
      >
        {c.problems.map((p, i) => (
          <li
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "44px minmax(0,1fr)",
              gap: 12,
              padding: "18px 0",
              borderBottom: `1px solid ${C.border.hairline}`,
            }}
          >
            <Ltr
              style={{ fontSize: 13, color: C.status.danger.fg, paddingTop: 2 }}
            >{`0${i + 1}`}</Ltr>
            <span>
              <span style={{ display: "block", fontWeight: 600, fontSize: 16.5 }}>
                {cell(p, 0)}
              </span>
              <span
                style={{ display: "block", fontSize: 14.5, color: C.text.secondary, marginTop: 2 }}
              >
                {cell(p, 1)}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </Band>
  );
}
