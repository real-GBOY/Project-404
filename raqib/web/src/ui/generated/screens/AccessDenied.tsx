/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import { Fragment } from "react";
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";
import { FONT } from "@/styles/typography";

export function AccessDenied({ vm }: { vm: VM }) {
  const { dn, pad, t } = vm;
  return (
    <>
      <div style={{ padding: pad, maxWidth: "620px", margin: "40px auto" }}>
        <section
          style={{
            background: C.surface.white,
            border: `1px solid ${C.border.hairline}`,
            borderRadius: "6px",
            padding: "28px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: "12px",
              color: C.status.danger.fg,
              letterSpacing: ".06em",
            }}
          >
            403
          </div>
          <h1 style={{ margin: "0", fontSize: "22px", fontWeight: "600" }}>{dn.title}</h1>
          <div style={{ fontSize: "14px", color: C.text.body }}>{dn.body}</div>
          <dl style={{ margin: "0", border: `1px solid ${C.surface.track}`, borderRadius: "4px" }}>
            {(dn.rows || []).map((r: any, __i: number) => (
              <Fragment key={__i}>
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    padding: "8px 12px",
                    borderBottom: `1px solid ${C.surface.subtle}`,
                    fontSize: "13px",
                  }}
                >
                  <dt style={{ color: C.text.muted, minWidth: "110px" }}>{r.k}</dt>
                  <dd style={{ margin: "0", fontWeight: "500" }}>{r.v}</dd>
                </div>
              </Fragment>
            ))}
          </dl>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              onClick={dn.home}
              style={{
                height: "42px",
                padding: "0 16px",
                border: "0",
                borderRadius: "4px",
                background: C.brand.primary,
                color: C.surface.white,
                cursor: "pointer",
              }}
            >
              {t.backHome}
            </button>
            {dn.canRequest ? (
              <>
                <button
                  onClick={dn.request}
                  style={{
                    height: "42px",
                    padding: "0 16px",
                    border: `1px solid ${C.border.input}`,
                    borderRadius: "4px",
                    background: C.surface.white,
                    cursor: "pointer",
                  }}
                >
                  {t.requestAccess}
                </button>
              </>
            ) : null}
          </div>
        </section>
      </div>
    </>
  );
}
