import { useState } from "react";
import { C } from "@/styles/colors";
import type { Lang } from "@/api/types";
import type { Copy } from "./copy-types";
import { Band, cell, Eyebrow, H2, Ltr, SHADOW, type Layout } from "./ui";

/** The product screens, captured from the working application (public/landing/shots/<name>-<lang>.png). */
const shot = (name: string, lang: Lang) => `/landing/shots/${name}-${lang}.png`;

export function Tour({ c, L, lang }: { c: Copy; L: Layout; lang: Lang }) {
  const [active, setActive] = useState(0);
  const t = c.tour[active] ?? c.tour[0]!;
  const phone = cell(t, 2) === "phone";
  const title = cell(t, 3);
  return (
    <Band id="tour" L={L} bg={C.surface.sunken} gap={24}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 640 }}>
          <Eyebrow>{c.tourEyebrow}</Eyebrow>
          <H2 L={L}>{c.tourTitle}</H2>
        </div>
        <div style={{ fontSize: 13, color: C.text.secondary, maxWidth: 360 }}>{c.tourNote}</div>
      </div>
      <div
        role="tablist"
        style={{
          display: "flex",
          gap: 4,
          overflowX: "auto",
          overflowY: "hidden",
          scrollbarWidth: "none",
          borderBottom: `1px solid ${C.border.input}`,
        }}
      >
        {c.tour.map((row, i) => (
          <button
            key={cell(row, 0)}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            style={{
              flexShrink: 0,
              height: 44,
              padding: "0 14px",
              border: 0,
              borderBottom: `2px solid ${i === active ? C.brand.primary : "transparent"}`,
              background: "none",
              color: i === active ? C.text.ink : C.text.secondary,
              fontWeight: i === active ? 600 : 500,
              fontSize: 14,
              cursor: "pointer",
              marginBottom: -1,
              whiteSpace: "nowrap",
            }}
          >
            {cell(row, 1)}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        style={{
          display: "grid",
          gridTemplateColumns: L.tourCols,
          gap: "24px 40px",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 20, lineHeight: 1.35 }}>{title}</div>
          <p style={{ margin: 0, fontSize: 15, color: C.text.body, textWrap: "pretty" }}>
            {cell(t, 4)}
          </p>
          <div style={{ fontSize: 12.5, color: C.text.secondary }}>{cell(t, 5)}</div>
        </div>
        {phone ? (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div
              style={{
                width: "100%",
                maxWidth: 560,
                padding: 16,
                borderRadius: 30,
                background: C.chrome.bgRaised,
                boxShadow: `inset 0 0 0 1.5px ${C.chrome.frame}, 0 24px 50px -16px ${C.shadow.viewer}`,
                position: "relative",
              }}
            >
              <div style={{ borderRadius: 14, overflow: "hidden", background: C.surface.white }}>
                <img
                  src={shot(cell(t, 0), lang)}
                  alt={title}
                  loading="lazy"
                  width={1668}
                  height={1698}
                  style={{ display: "block", width: "100%", height: "auto" }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              minWidth: 0,
              background: C.surface.white,
              border: `1px solid ${C.border.input}`,
              borderRadius: 6,
              overflow: "hidden",
              boxShadow: SHADOW,
            }}
          >
            <div
              style={{
                height: 30,
                background: C.surface.canvas,
                borderBottom: `1px solid ${C.border.hairline}`,
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "0 12px",
              }}
            >
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  style={{ width: 9, height: 9, borderRadius: "50%", background: C.border.input }}
                />
              ))}
              <Ltr style={{ flex: 1, textAlign: "center", fontSize: 11, color: C.text.muted }}>
                {cell(t, 6)}
              </Ltr>
            </div>
            <img
              src={shot(cell(t, 0), lang)}
              alt={title}
              loading="lazy"
              width={3288}
              height={1698}
              style={{
                display: "block",
                width: "100%",
                height: "auto",
                background: C.surface.canvas,
              }}
            />
          </div>
        )}
      </div>
    </Band>
  );
}
