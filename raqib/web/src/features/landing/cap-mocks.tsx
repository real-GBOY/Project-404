import type { ReactNode } from "react";
import { C } from "@/styles/colors";
import type { Copy } from "./copy-types";
import { cell, Chip, HATCH, Ltr, tone } from "./ui";

const line = `1px solid ${C.border.hairline}`;
const rowLine = `1px solid ${C.surface.track}`;

/** The grey stage every capability illustration sits on. */
function Stage({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        height: 300,
        background: C.surface.canvas,
        border: line,
        borderRadius: 6,
        padding: 22,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div style={{ width: "100%", maxWidth: 440 }}>{children}</div>
    </div>
  );
}

/** A captioned capability: its illustration, a letter and the explanation. */
export function Capability({
  letter,
  title,
  text,
  children,
}: {
  letter: string;
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <article style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
      <Stage>{children}</Stage>
      <div style={{ display: "grid", gridTemplateColumns: "28px minmax(0,1fr)", gap: 12 }}>
        <Ltr style={{ fontSize: 12, color: C.text.muted, paddingTop: 4 }}>{letter}</Ltr>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 20,
              lineHeight: 1.35,
              fontWeight: 700,
              textWrap: "balance",
            }}
          >
            {title}
          </h3>
          <p style={{ margin: 0, fontSize: 15, color: C.text.body, textWrap: "pretty" }}>{text}</p>
        </div>
      </div>
    </article>
  );
}

export function VisitsMock({ c }: { c: Copy }) {
  return (
    <div style={{ border: line, borderRadius: 4, overflow: "hidden", background: C.surface.white }}>
      {c.visits.map((v) => (
        <div
          key={cell(v, 3)}
          style={{
            display: "grid",
            gridTemplateColumns: "auto minmax(0,1fr) auto",
            gap: 12,
            alignItems: "center",
            padding: "10px 14px",
            borderBottom: rowLine,
          }}
        >
          <span style={{ textAlign: "center", lineHeight: 1.1, minWidth: 34 }}>
            <Ltr style={{ display: "block", fontWeight: 600, fontSize: 15 }}>{cell(v, 0)}</Ltr>
            <span style={{ display: "block", fontSize: 10.5, color: C.text.muted }}>
              {cell(v, 1)}
            </span>
          </span>
          <span style={{ minWidth: 0 }}>
            <span
              style={{
                display: "block",
                fontSize: 13.5,
                fontWeight: 500,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {cell(v, 2)}
            </span>
            <span style={{ display: "block", fontSize: 11.5, color: C.text.muted }}>
              <Ltr>{cell(v, 3)}</Ltr> · {cell(v, 4)}
            </span>
          </span>
          <Chip text={cell(v, 5)} k={cell(v, 6)} />
        </div>
      ))}
    </div>
  );
}

export function EvidenceMock({ c }: { c: Copy }) {
  return (
    <div
      style={{
        border: line,
        borderRadius: 4,
        background: C.surface.white,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ fontSize: 13 }}>
        <Ltr style={{ color: C.text.secondary }}>4.2</Ltr> <b>{c.cItem}</b>{" "}
        <span style={{ color: C.status.danger.fg, fontSize: 12 }}>· {c.m.nc}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8 }}>
        {c.evidence.map((e) => (
          <div key={cell(e, 1)} style={{ border: line, borderRadius: 4, overflow: "hidden" }}>
            <div
              style={{
                height: 64,
                background: HATCH(),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ltr
                style={{
                  fontSize: 10,
                  color: C.text.secondary,
                  background: C.glass,
                  padding: "0 4px",
                }}
              >
                {cell(e, 0)}
              </Ltr>
            </div>
            <div style={{ padding: "6px 8px" }}>
              <div
                dir="ltr"
                style={{
                  fontSize: 11,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  textAlign: "start",
                }}
              >
                {cell(e, 1)}
              </div>
              <div style={{ fontSize: 11, color: tone(cell(e, 3))[0], fontWeight: 500 }}>
                {cell(e, 2)}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: C.text.secondary, borderTop: rowLine, paddingTop: 8 }}>
        {c.cMeta}
      </div>
    </div>
  );
}

export function ReportMock({ c }: { c: Copy }) {
  return (
    <div
      style={{
        background: C.surface.white,
        padding: "16px 18px",
        boxShadow: `0 1px 3px ${C.shadow.soft}`,
        display: "flex",
        flexDirection: "column",
        gap: 9,
        fontSize: 11,
        marginBottom: -60,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: `2px solid ${C.text.ink}`,
          paddingBottom: 8,
        }}
      >
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span
            style={{
              width: 20,
              height: 20,
              background: C.brand.primary,
              borderRadius: 3,
              color: C.surface.white,
              fontSize: 11,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ر
          </span>
          <b style={{ fontSize: 12 }}>{c.dDoc}</b>
        </span>
        <Ltr
          style={{
            width: 64,
            height: 22,
            border: `1px dashed ${C.border.strong}`,
            fontSize: 8,
            color: C.text.secondary,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {c.clientLogo}
        </Ltr>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          border: `1px solid ${C.border.input}`,
        }}
      >
        {c.reportKv.map((k) => (
          <div
            key={cell(k, 0)}
            style={{ padding: "4px 6px", borderBottom: line, borderInlineEnd: line }}
          >
            <div style={{ fontSize: 8.5, color: C.text.secondary }}>{cell(k, 0)}</div>
            <div style={{ fontWeight: 600, fontSize: 10.5 }}>{cell(k, 1)}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {c.reportRows.map((r) => (
          <div
            key={cell(r, 0)}
            style={{
              display: "grid",
              gridTemplateColumns: "24px minmax(0,1fr) 60px",
              gap: 6,
              padding: "3px 0",
              borderBottom: rowLine,
            }}
          >
            <Ltr style={{ color: C.text.secondary }}>{cell(r, 0)}</Ltr>
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {cell(r, 1)}
            </span>
            <span style={{ color: tone(cell(r, 3))[0], fontWeight: 600, textAlign: "end" }}>
              {cell(r, 2)}
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 4 }}>
        {c.signs.map((s) => (
          <div key={cell(s, 0)} style={{ borderTop: `1px solid ${C.text.ink}`, paddingTop: 3 }}>
            <div style={{ fontSize: 8.5, color: C.text.secondary }}>{cell(s, 0)}</div>
            <div style={{ fontWeight: 600, fontSize: 10 }}>{cell(s, 1)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PermissionsMock({ c }: { c: Copy }) {
  const th: React.CSSProperties = {
    padding: "8px 4px",
    fontWeight: 500,
    color: C.text.secondary,
    fontSize: 11.5,
    borderBottom: line,
    textAlign: "center",
  };
  return (
    <div style={{ border: line, borderRadius: 4, background: C.surface.white, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: C.surface.paper }}>
            <th style={{ ...th, textAlign: "start", padding: "8px 12px" }}>{c.eRole}</th>
            {c.permCols.map((p) => (
              <th key={p} style={th}>
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {c.permRows.map((r) => (
            <tr key={cell(r, 0)}>
              <td
                style={{
                  padding: "8px 12px",
                  borderBottom: rowLine,
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                }}
              >
                {cell(r, 0)}
              </td>
              {cell(r, 1)
                .split("")
                .map((bit, i) => (
                  <td key={i} style={{ padding: 5, borderBottom: rowLine, textAlign: "center" }}>
                    <span
                      aria-label={bit === "1" ? "✓" : "–"}
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 3,
                        border: `1.5px solid ${bit === "1" ? C.brand.primary : C.border.strong}`,
                        background: bit === "1" ? C.brand.primary : C.surface.white,
                        color: C.surface.white,
                        fontSize: 11,
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {bit === "1" ? "✓" : ""}
                    </span>
                  </td>
                ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div
        style={{
          fontSize: 12,
          color: C.text.secondary,
          padding: "9px 12px",
          background: C.surface.paper,
        }}
      >
        {c.eNote}
      </div>
    </div>
  );
}
