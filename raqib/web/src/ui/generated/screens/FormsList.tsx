/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import { Fragment } from "react";
import { Hover } from "@/components/Hover";
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";
import { FONT } from "@/styles/typography";

export function FormsList({ vm }: { vm: VM }) {
  const { fl, pad, pageTitle, t } = vm;
  return (
    <>
      <div
        style={{
          padding: pad,
          maxWidth: "1360px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ margin: "0", fontSize: "22px", fontWeight: "600" }}>{pageTitle}</h1>
            <div style={{ fontSize: "13px", color: C.text.secondary }}>{t.formsSub}</div>
          </div>
          {fl.canAdd ? (
            <>
              <button
                onClick={fl.add}
                style={{
                  height: "40px",
                  padding: "0 16px",
                  border: "0",
                  borderRadius: "4px",
                  background: C.brand.primary,
                  color: C.surface.white,
                  fontWeight: "500",
                  cursor: "pointer",
                }}
              >
                {t.newForm}
              </button>
            </>
          ) : null}
        </div>
        <section
          style={{
            background: C.surface.white,
            border: `1px solid ${C.border.hairline}`,
            borderRadius: "6px",
          }}
        >
          {(fl.rows || []).map((f: any, __i: number) => (
            <Fragment key={__i}>
              <Hover
                as="button"
                onClick={f.go}
                style={{
                  width: "100%",
                  display: "flex",
                  gap: "10px 20px",
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
                <span style={{ flex: "1", minWidth: "240px" }}>
                  <span style={{ display: "block", fontWeight: "500" }}>{f.name}</span>
                  <span style={{ display: "block", fontSize: "12px", color: C.text.muted }}>
                    <span style={{ fontFamily: FONT.mono }}>{f.code}</span>· {f.cat} · {f.by} ·{" "}
                    {f.updated}
                  </span>
                </span>
                <span style={{ lineHeight: "1.25" }}>
                  <span style={{ display: "block", fontSize: "11px", color: C.text.muted }}>
                    {t.curVersion}
                  </span>
                  <span style={{ fontFamily: FONT.mono, fontWeight: "600" }}>{f.cur}</span>
                </span>
                {f.hasDraft ? (
                  <>
                    <span
                      style={{
                        height: "22px",
                        padding: "0 8px",
                        borderRadius: "3px",
                        fontSize: "12px",
                        color: C.status.warning.fg,
                        background: C.status.warning.bg,
                        display: "inline-flex",
                        alignItems: "center",
                      }}
                    >
                      {f.draft}
                    </span>
                  </>
                ) : null}
                <span style={{ fontSize: "12px", color: C.text.secondary }}>
                  {f.nver} {t.versionsWord} · {f.uses} {t.inspWord}
                </span>
                <span
                  style={{
                    height: "22px",
                    padding: "0 8px",
                    borderRadius: "3px",
                    fontSize: "12px",
                    fontWeight: "500",
                    color: f.st.fg,
                    background: f.st.bg,
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  {f.st.label}
                </span>
              </Hover>
            </Fragment>
          ))}
        </section>
        <div
          style={{
            fontSize: "12.5px",
            color: C.text.body,
            background: C.surface.sunken,
            borderRadius: "4px",
            padding: "10px 12px",
          }}
        >
          {t.formsVersionNote}
        </div>
      </div>
    </>
  );
}
