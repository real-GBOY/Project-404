/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import { Fragment } from "react";
import { Hover } from "@/components/Hover";
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";
import { FONT } from "@/styles/typography";

export function OverviewProjectManager({ vm }: { vm: VM }) {
  const { greeting, pad, pm, t, todayLong } = vm;
  return (
    <>
      <div
        style={{
          padding: pad,
          maxWidth: "1180px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        <div>
          <div style={{ fontSize: "13px", color: C.text.secondary }}>{todayLong}</div>
          <h1 style={{ margin: "2px 0 0", fontSize: "22px", fontWeight: "600" }}>{greeting}</h1>
          <div style={{ fontSize: "13px", color: C.text.secondary, marginTop: "4px" }}>
            {pm.next}
          </div>
        </div>
        <div
          style={{
            background: C.surface.white,
            border: `1px solid ${C.border.hairline}`,
            borderRadius: "6px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
            overflow: "hidden",
          }}
        >
          {(pm.attention || []).map((a: any, __i: number) => (
            <Fragment key={__i}>
              <Hover
                as="button"
                onClick={a.go}
                style={{
                  textAlign: "start",
                  background: C.surface.white,
                  border: "0",
                  borderInlineEnd: `1px solid ${C.surface.track}`,
                  borderBottom: `1px solid ${C.surface.track}`,
                  padding: "16px 18px",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  marginBottom: "-1px",
                }}
                hover={{ background: C.surface.paper }}
              >
                <span
                  style={{
                    fontSize: "28px",
                    fontWeight: "600",
                    lineHeight: "1.15",
                    color: a.color,
                  }}
                >
                  {a.n}
                </span>
                <span style={{ fontSize: "13.5px", fontWeight: "500" }}>{a.label}</span>
                <span style={{ fontSize: "12px", color: C.text.muted }}>{a.sub}</span>
              </Hover>
            </Fragment>
          ))}
        </div>
        <section
          style={{
            background: C.surface.white,
            border: `1px solid ${C.border.hairline}`,
            borderRadius: "6px",
          }}
        >
          <h2
            style={{
              margin: "0",
              fontSize: "15px",
              fontWeight: "600",
              padding: "14px 18px",
              borderBottom: `1px solid ${C.surface.track}`,
            }}
          >
            {t.yourProjects}
          </h2>
          {(pm.projects || []).map((p: any, __i: number) => (
            <Fragment key={__i}>
              <Hover
                as="button"
                onClick={p.go}
                style={{
                  width: "100%",
                  display: "flex",
                  gap: "16px",
                  alignItems: "center",
                  padding: "14px 18px",
                  border: "0",
                  borderBottom: `1px solid ${C.surface.track}`,
                  background: C.surface.white,
                  cursor: "pointer",
                  textAlign: "start",
                  flexWrap: "wrap",
                }}
                hover={{ background: C.surface.paper }}
              >
                <span style={{ flex: "1", minWidth: "200px" }}>
                  <span style={{ display: "block", fontSize: "14.5px", fontWeight: "600" }}>
                    {p.name}
                  </span>
                  <span style={{ display: "block", fontSize: "12px", color: C.text.muted }}>
                    <span style={{ fontFamily: FONT.mono }}>{p.code}</span>· {p.sub}
                  </span>
                </span>
                <span
                  style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "160px" }}
                >
                  <span
                    style={{
                      flex: "1",
                      height: "6px",
                      background: C.surface.track,
                      borderRadius: "3px",
                      overflow: "hidden",
                      display: "block",
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        height: "100%",
                        width: p.scoreW,
                        background: p.scoreC,
                      }}
                    ></span>
                  </span>
                  <span style={{ fontWeight: "600", color: p.scoreC }}>{p.scoreTxt}</span>
                </span>
              </Hover>
            </Fragment>
          ))}
        </section>
        <section
          style={{
            background: C.surface.white,
            border: `1px solid ${C.border.hairline}`,
            borderRadius: "6px",
          }}
        >
          <h2
            style={{
              margin: "0",
              fontSize: "15px",
              fontWeight: "600",
              padding: "14px 18px",
              borderBottom: `1px solid ${C.surface.track}`,
            }}
          >
            {t.assignedToYou}
          </h2>
          {(pm.cas || []).map((a: any, __i: number) => (
            <Fragment key={__i}>
              <Hover
                as="button"
                onClick={a.go}
                style={{
                  width: "100%",
                  display: "flex",
                  gap: "12px",
                  alignItems: "center",
                  padding: "12px 18px",
                  border: "0",
                  borderBottom: `1px solid ${C.surface.subtle}`,
                  background: C.surface.white,
                  cursor: "pointer",
                  textAlign: "start",
                  flexWrap: "wrap",
                }}
                hover={{ background: C.surface.paper }}
              >
                <span style={{ flex: "1", minWidth: "220px" }}>
                  <span style={{ display: "block", fontSize: "14px", fontWeight: "500" }}>
                    {a.t}
                  </span>
                  <span style={{ display: "block", fontSize: "12px", color: C.text.muted }}>
                    <span style={{ fontFamily: FONT.mono }}>{a.ref}</span>· {a.proj}
                  </span>
                </span>
                <span
                  style={{ fontSize: "12.5px", color: a.dueC, textAlign: "end", lineHeight: "1.3" }}
                >
                  <span style={{ display: "block" }}>{a.due}</span>
                  <span style={{ display: "block" }}>{a.dueSub}</span>
                </span>
                <span
                  style={{
                    height: "22px",
                    padding: "0 8px",
                    borderRadius: "3px",
                    fontSize: "12px",
                    fontWeight: "500",
                    color: a.st.fg,
                    background: a.st.bg,
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  {a.st.label}
                </span>
              </Hover>
            </Fragment>
          ))}
        </section>
      </div>
    </>
  );
}
