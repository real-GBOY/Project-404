/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import { Fragment } from "react";
import { Hover } from "@/components/Hover";
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";
import { FONT } from "@/styles/typography";

export function ReviewQueue({ vm }: { vm: VM }) {
  const { pad, rq, t } = vm;
  return (
    <>
      <div
        style={{
          padding: pad,
          maxWidth: "1240px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div>
          <h1 style={{ margin: "0", fontSize: "22px", fontWeight: "600" }}>{rq.title}</h1>
          <div style={{ fontSize: "13px", color: C.text.secondary }}>{rq.sub}</div>
        </div>
        <div
          style={{
            display: "flex",
            gap: "4px",
            borderBottom: `1px solid ${C.border.hairline}`,
            overflowX: "auto",
          }}
        >
          {(rq.tabs || []).map((tb: any, __i: number) => (
            <Fragment key={__i}>
              <button
                onClick={tb.go}
                style={{
                  height: "42px",
                  padding: "0 14px",
                  border: "0",
                  borderBottom: `2px solid ${tb.bd}`,
                  background: "none",
                  color: tb.fg,
                  fontWeight: tb.fw,
                  fontSize: "13.5px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  marginBottom: "-1px",
                  display: "flex",
                  gap: "6px",
                  alignItems: "center",
                }}
              >
                {tb.label}
                <span
                  style={{
                    fontSize: "11.5px",
                    background: C.surface.sunken,
                    borderRadius: "9px",
                    padding: "0 7px",
                    color: C.text.body,
                  }}
                >
                  {tb.n}
                </span>
              </button>
            </Fragment>
          ))}
        </div>
        {rq.has ? (
          <>
            <section
              style={{
                background: C.surface.white,
                border: `1px solid ${C.border.hairline}`,
                borderRadius: "6px",
              }}
            >
              {(rq.rows || []).map((v: any, __i: number) => (
                <Fragment key={__i}>
                  <Hover
                    as="button"
                    onClick={v.go}
                    style={{
                      width: "100%",
                      display: "flex",
                      gap: "12px 20px",
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
                    <span style={{ flex: "1", minWidth: "220px" }}>
                      <span style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <span
                          style={{
                            fontFamily: FONT.mono,
                            fontSize: "12.5px",
                            color: C.text.secondary,
                          }}
                        >
                          {v.ref}
                        </span>
                        <span
                          style={{
                            height: "20px",
                            padding: "0 7px",
                            borderRadius: "3px",
                            fontSize: "11.5px",
                            fontWeight: "500",
                            color: v.st.fg,
                            background: v.st.bg,
                            display: "inline-flex",
                            alignItems: "center",
                          }}
                        >
                          {v.st.label}
                        </span>
                      </span>
                      <span style={{ display: "block", fontWeight: "500", marginTop: "2px" }}>
                        {v.proj} · {v.site}
                      </span>
                      <span style={{ display: "block", fontSize: "12px", color: C.text.muted }}>
                        {v.ins} · {v.lastBy} · {v.at}
                      </span>
                    </span>
                    <span
                      style={{
                        display: "flex",
                        gap: "18px",
                        fontSize: "12.5px",
                        color: C.text.secondary,
                      }}
                    >
                      <span>
                        <span style={{ display: "block", fontSize: "11px" }}>{t.c_score}</span>
                        <span style={{ fontWeight: "600", fontSize: "15px", color: v.scoreC }}>
                          {v.score}
                        </span>
                      </span>
                      <span>
                        <span style={{ display: "block", fontSize: "11px" }}>{t.ans_n}</span>
                        <span style={{ fontWeight: "600", fontSize: "15px", color: C.text.ink }}>
                          {v.nc}
                        </span>
                      </span>
                      <span>
                        <span style={{ display: "block", fontSize: "11px" }}>{t.st_evidence}</span>
                        <span style={{ fontWeight: "600", fontSize: "15px", color: C.text.ink }}>
                          {v.ev}
                        </span>
                      </span>
                      <span>
                        <span style={{ display: "block", fontSize: "11px" }}>{t.waiting}</span>
                        <span style={{ fontWeight: "500", fontSize: "13px", color: C.text.ink }}>
                          {v.age}
                        </span>
                      </span>
                    </span>
                  </Hover>
                </Fragment>
              ))}
            </section>
          </>
        ) : null}
        {rq.none ? (
          <>
            <div
              style={{
                background: C.surface.white,
                border: `1px dashed ${C.border.input}`,
                borderRadius: "6px",
                padding: "40px 20px",
                textAlign: "center",
                color: C.text.secondary,
              }}
            >
              {rq.emptyTxt}
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
