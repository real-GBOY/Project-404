import { C } from "@/styles/colors";
import { Capability, EvidenceMock, PermissionsMock, ReportMock, VisitsMock } from "./cap-mocks";
import type { Copy } from "./copy-types";
import { Band, cell, Heading, Ltr, Points, tone, type Layout } from "./ui";

/** Feature A: the form-versioning panel beside its explanation. */
function Versioning({ c, L }: { c: Copy; L: Layout }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: L.featCols,
        gap: "32px 48px",
        alignItems: "center",
        paddingBottom: 48,
        borderBottom: `1px solid ${C.border.hairline}`,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Ltr style={{ fontSize: 12, color: C.text.muted }}>A</Ltr>
        <h3
          style={{
            margin: 0,
            fontSize: L.h3big,
            lineHeight: 1.25,
            fontWeight: 700,
            textWrap: "balance",
          }}
        >
          {c.aT}
        </h3>
        <p style={{ margin: 0, fontSize: 16, color: C.text.body, textWrap: "pretty" }}>{c.aD}</p>
        <Points items={c.aPoints} />
      </div>
      <div
        style={{
          background: C.surface.canvas,
          border: `1px solid ${C.border.hairline}`,
          borderRadius: 6,
          padding: 18,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div>
            <Ltr
              style={{
                display: "block",
                fontSize: 12,
                color: C.text.secondary,
                textAlign: "start",
              }}
            >
              FRM-SEC-01
            </Ltr>
            <div style={{ fontWeight: 600 }}>{c.aForm}</div>
          </div>
          <span
            style={{
              fontSize: 12.5,
              color: C.brand.primary,
              border: `1px solid ${C.brand.primary}`,
              borderRadius: 4,
              padding: "4px 10px",
              background: C.surface.white,
            }}
          >
            {c.aNewV}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {c.versions.map((v) => {
            const [fg, bg] = tone(cell(v, 4));
            return (
              <div
                key={cell(v, 0)}
                style={{
                  background: C.surface.white,
                  border: `1px solid ${cell(v, 4) === "success" ? C.brand.primary : C.border.hairline}`,
                  borderRadius: 4,
                  padding: "10px 12px",
                  display: "grid",
                  gridTemplateColumns: "52px minmax(0,1fr) auto",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <Ltr style={{ fontWeight: 600 }}>{cell(v, 0)}</Ltr>
                <span style={{ minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: 13,
                      color: C.text.body,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {cell(v, 1)}
                  </span>
                  <span style={{ display: "block", fontSize: 11.5, color: C.text.muted }}>
                    {cell(v, 2)}
                  </span>
                </span>
                <span
                  style={{
                    height: 20,
                    padding: "0 7px",
                    borderRadius: 3,
                    fontSize: 11.5,
                    color: fg,
                    background: bg,
                    whiteSpace: "nowrap",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  {cell(v, 3)}
                </span>
              </div>
            );
          })}
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: C.text.ink,
            background: C.surface.sunken,
            borderRadius: 4,
            padding: "9px 12px",
          }}
        >
          <Ltr style={{ fontSize: 11.5, color: C.text.secondary }}>VIS-26-0398 → v2.0</Ltr> ·{" "}
          {c.aLock}
        </div>
      </div>
    </div>
  );
}

export function Capabilities({ c, L }: { c: Copy; L: Layout }) {
  return (
    <Band id="capabilities" L={L} bg={C.surface.white} gap={40}>
      <Heading L={L} eyebrow={c.capEyebrow} title={c.capTitle} />
      <Versioning c={c} L={L} />
      <div style={{ display: "grid", gridTemplateColumns: L.capCols, gap: "48px 40px" }}>
        <Capability letter="B" title={c.bT} text={c.bD}>
          <VisitsMock c={c} />
        </Capability>
        <Capability letter="C" title={c.cT} text={c.cD}>
          <EvidenceMock c={c} />
        </Capability>
        <Capability letter="D" title={c.dT} text={c.dD}>
          <ReportMock c={c} />
        </Capability>
        <Capability letter="E" title={c.eT} text={c.eD}>
          <PermissionsMock c={c} />
        </Capability>
      </div>
    </Band>
  );
}
