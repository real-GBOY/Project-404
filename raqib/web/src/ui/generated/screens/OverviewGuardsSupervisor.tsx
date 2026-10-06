/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import { Fragment } from "react";
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";
import { FONT } from "@/styles/typography";

export function OverviewGuardsSupervisor({ vm }: { vm: VM }) {
  const { gd, greeting, pad, t, todayLong } = vm;
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
        </div>
        <section
          style={{
            background: C.surface.white,
            border: `1px solid ${C.border.hairline}`,
            borderRadius: "6px",
          }}
        >
          <div
            style={{
              padding: "14px 18px",
              borderBottom: `1px solid ${C.surface.track}`,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600" }}>
              {t.trainingRequests}
            </h2>
          </div>
          {(gd.training || []).map((r: any, __i: number) => (
            <Fragment key={__i}>
              <button
                onClick={r.go}
                style={{
                  width: "100%",
                  border: "0",
                  background: C.surface.white,
                  cursor: "pointer",
                  textAlign: "start",
                  display: "flex",
                  gap: "12px",
                  alignItems: "center",
                  padding: "12px 18px",
                  borderBottom: `1px solid ${C.surface.subtle}`,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontFamily: FONT.mono, fontSize: "12px", color: C.text.secondary }}>
                  {r.ref}
                </span>
                <span style={{ flex: "1", minWidth: "200px" }}>
                  <span style={{ display: "block", fontWeight: "500" }}>{r.who}</span>
                  <span style={{ display: "block", fontSize: "12.5px", color: C.text.secondary }}>
                    {r.what}
                  </span>
                </span>
                <span
                  style={{
                    height: "22px",
                    padding: "0 8px",
                    borderRadius: "3px",
                    fontSize: "12px",
                    color: r.st.fg,
                    background: r.st.bg,
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  {r.st.label}
                </span>
              </button>
            </Fragment>
          ))}
        </section>
      </div>
    </>
  );
}
