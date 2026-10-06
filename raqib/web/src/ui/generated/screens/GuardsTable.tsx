/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import { Fragment } from "react";
import { Hover } from "@/components/Hover";
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";
import { FONT } from "@/styles/typography";

export function GuardsTable({ vm }: { vm: VM }) {
  const { gd, hpad, t } = vm;
  return (
    <>
      <div style={{ padding: `0 ${hpad} 32px`, maxWidth: "1180px", margin: "0 auto" }}>
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
            {t.guardsInScope}
          </h2>
          {(gd.rows || []).map((g: any, __i: number) => (
            <Fragment key={__i}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  borderBottom: `1px solid ${C.surface.subtle}`,
                  background: C.surface.white,
                  opacity: g.inactive ? 0.6 : 1,
                }}
              >
                <Hover
                  as="button"
                  onClick={g.go}
                  style={{
                    flex: "1",
                    minWidth: "0",
                    border: "0",
                    background: C.surface.white,
                    cursor: "pointer",
                    textAlign: "start",
                    display: "flex",
                    gap: "14px",
                    alignItems: "center",
                    padding: "12px 18px",
                    flexWrap: "wrap",
                  }}
                  hover={{ background: C.surface.paper }}
                >
                  <span style={{ flex: "1", minWidth: "200px" }}>
                    <span style={{ display: "block", fontWeight: "500" }}>{g.name}</span>
                    <span style={{ display: "block", fontSize: "12px", color: C.text.muted }}>
                      <span style={{ fontFamily: FONT.mono }}>{g.emp}</span>· {g.post} · {g.proj}
                    </span>
                    {g.hasFlag ? (
                      <>
                        <span
                          style={{
                            display: "block",
                            fontSize: "12px",
                            color: C.status.warning.fg,
                            marginTop: "2px",
                          }}
                        >
                          {g.flag}
                        </span>
                      </>
                    ) : null}
                  </span>
                  <span style={{ fontSize: "12px", color: C.text.secondary }}>
                    {g.evals} {t.evaluations}
                  </span>
                  <span
                    style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "130px" }}
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
                          width: g.avgW,
                          background: g.avgC,
                        }}
                      ></span>
                    </span>
                    <span
                      style={{
                        fontWeight: "600",
                        color: g.avgC,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {g.avg}
                    </span>
                  </span>
                </Hover>
                {gd.canManage ? (
                  <>
                    <span style={{ display: "flex", gap: "6px", padding: "0 14px" }}>
                      <button
                        onClick={g.edit}
                        style={{
                          height: "30px",
                          padding: "0 10px",
                          border: `1px solid ${C.border.input}`,
                          borderRadius: "4px",
                          background: C.surface.white,
                          color: C.text.ink,
                          fontSize: "12.5px",
                          cursor: "pointer",
                        }}
                      >
                        {t.pa_editGuard}
                      </button>
                      <button
                        onClick={g.toggle}
                        style={{
                          height: "30px",
                          padding: "0 10px",
                          border: `1px solid ${C.border.input}`,
                          borderRadius: "4px",
                          background: C.surface.white,
                          color: C.text.ink,
                          fontSize: "12.5px",
                          cursor: "pointer",
                        }}
                      >
                        {g.toggleLabel}
                      </button>
                    </span>
                  </>
                ) : null}
              </div>
            </Fragment>
          ))}
        </section>
      </div>
    </>
  );
}
