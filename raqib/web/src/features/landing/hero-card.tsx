import { C } from "@/styles/colors";
import type { Copy } from "./copy-types";
import { AnswerRow, HATCH, Ltr, SHADOW } from "./ui";

const pill = (bg: string): React.CSSProperties => ({
  flex: 1,
  height: 4,
  borderRadius: 2,
  background: bg,
});

/** The inspection card shown beside the headline. */

export function HeroCard({ c }: { c: Copy }) {
  const { m } = c;
  const stage = (i: number) =>
    i === 0 ? C.status.success.fg : i === 1 ? C.status.review.fg : C.border.hairline;
  const evidenceThumb: React.CSSProperties = {
    width: 84,
    height: 64,
    border: `1px solid ${C.border.hairline}`,
    borderRadius: 3,
    background: HATCH(),
    display: "flex",
    padding: 4,
  };
  const tag: React.CSSProperties = { fontSize: 9.5, background: C.glass, padding: "0 4px" };
  return (
    <div
      style={{
        background: C.surface.white,
        border: `1px solid ${C.border.hairline}`,
        borderRadius: 6,
        boxShadow: SHADOW,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          borderBottom: `1px solid ${C.surface.track}`,
          flexWrap: "wrap",
        }}
      >
        <Ltr style={{ fontSize: 12.5, color: C.text.secondary }}>VIS-26-0409</Ltr>
        <span
          style={{
            height: 22,
            padding: "0 8px",
            borderRadius: 3,
            fontSize: 12,
            fontWeight: 500,
            color: C.status.info.fg,
            background: C.status.info.bg,
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          {m.inProgress}
        </span>
        <span style={{ flex: 1 }} />
        <Ltr style={{ fontSize: 11.5, color: C.text.muted }}>FRM-SEC-01 v2.1</Ltr>
      </div>
      <div
        style={{
          padding: "14px 16px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          borderBottom: `1px solid ${C.surface.track}`,
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 15 }}>{m.site}</div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12.5,
            color: C.text.secondary,
            gap: 10,
          }}
        >
          <span>{m.section}</span>
          <span>
            {m.score} <b style={{ color: C.status.warning.score }}>82%</b>
          </span>
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          {[C.status.success.fg, C.brand.primary, "", "", "", ""].map((bg, i) => (
            <span key={i} style={pill(bg || C.border.hairline)} />
          ))}
        </div>
      </div>
      <div
        style={{
          padding: "14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          borderInlineStart: `3px solid ${C.status.danger.fg}`,
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
          <Ltr style={{ fontSize: 12.5, color: C.text.secondary }}>2.3</Ltr>
          <span style={{ flex: 1, fontSize: 14.5, fontWeight: 500 }}>{m.item}</span>
          <span style={{ fontSize: 11.5, color: C.text.muted, whiteSpace: "nowrap" }}>
            {m.weight}
          </span>
        </div>
        <AnswerRow labels={[m.c, m.nc, m.na]} pick={1} height={42} size={13.5} />
        <div
          style={{
            fontSize: 13,
            background: C.surface.paper,
            border: `1px solid ${C.surface.track}`,
            borderRadius: 4,
            padding: "8px 10px",
            color: C.text.body,
          }}
        >
          {m.note}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
          <div style={{ ...evidenceThumb, alignItems: "flex-end" }}>
            <Ltr style={{ ...tag, color: C.status.success.fg }}>IMG_0412 ✓</Ltr>
          </div>
          <div
            style={{
              ...evidenceThumb,
              flexDirection: "column",
              justifyContent: "flex-end",
              gap: 3,
            }}
          >
            <span
              style={{
                height: 3,
                background: C.border.hairline,
                borderRadius: 2,
                display: "block",
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  display: "block",
                  height: "100%",
                  width: "64%",
                  background: C.status.info.fg,
                }}
              />
            </span>
            <Ltr style={{ ...tag, color: C.status.info.fg }}>MP4 · 64%</Ltr>
          </div>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              border: `1px dashed ${C.brand.primary}`,
              borderRadius: 3,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12.5,
              color: C.brand.primary,
              textAlign: "center",
              padding: 4,
            }}
          >
            {m.capture}
          </div>
        </div>
      </div>
      <div
        style={{
          padding: "12px 16px",
          background: C.surface.paper,
          borderTop: `1px solid ${C.surface.track}`,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 12, color: C.text.secondary }}>{m.after}</div>
        <div style={{ display: "flex", gap: 4 }}>
          {m.stages.map((label, i) => (
            <div key={label} style={{ flex: 1, minWidth: 0 }}>
              <div style={{ height: 4, borderRadius: 2, background: stage(i) }} />
              <div
                style={{
                  fontSize: 11.5,
                  marginTop: 4,
                  color: i < 2 ? C.text.ink : C.text.muted,
                  fontWeight: i === 1 ? 600 : 500,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
