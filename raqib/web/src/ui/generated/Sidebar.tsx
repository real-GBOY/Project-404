/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import { Fragment } from "react";
import { Hover } from "@/components/Hover";
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";

export function Sidebar({ vm }: { vm: VM }) {
  const { meIni, meName, meScope, meTitle, navGroups, sideW, t } = vm;
  return (
    <>
      <aside
        style={{
          width: sideW,
          flexShrink: "0",
          background: C.chrome.bg,
          color: C.chrome.textStrong,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        <div
          style={{ padding: "18px 20px 14px", display: "flex", alignItems: "center", gap: "10px" }}
        >
          <div
            style={{
              width: "30px",
              height: "30px",
              background: C.brand.primary,
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: C.surface.white,
              fontWeight: "700",
              fontSize: "15px",
            }}
          >
            {t.logoMark}
          </div>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: "1.2" }}>
            <span style={{ fontWeight: "600", color: C.surface.white, fontSize: "16px" }}>
              {t.brand}
            </span>
            <span style={{ fontSize: "11px", color: C.chrome.textFaint }}>{t.brandSub}</span>
          </div>
        </div>
        {(navGroups || []).map((g: any, __i: number) => (
          <Fragment key={__i}>
            <div
              style={{
                padding: "14px 20px 6px",
                fontSize: "11px",
                color: C.chrome.textFainter,
                letterSpacing: ".03em",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>{g.label}</span>
              {g.restricted ? (
                <>
                  <span
                    style={{
                      border: `1px solid ${C.status.danger.darkLine}`,
                      color: C.status.danger.onDark,
                      borderRadius: "2px",
                      padding: "0 5px",
                      fontSize: "10px",
                    }}
                  >
                    {t.restrictedTag}
                  </span>
                </>
              ) : null}
            </div>
            {(g.items || []).map((it: any, __i: number) => (
              <Fragment key={__i}>
                <Hover
                  as="button"
                  onClick={it.go}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    textAlign: "start",
                    border: "0",
                    borderInlineStart: `2px solid ${it.bar}`,
                    background: it.bg,
                    color: it.fg,
                    padding: "8px 18px",
                    fontSize: "13.5px",
                    cursor: "pointer",
                    minHeight: "36px",
                  }}
                  hover={{ background: C.chrome.bgRaised }}
                >
                  <span style={{ flex: "1" }}>{it.label}</span>
                  {it.hasCount ? (
                    <>
                      <span
                        style={{
                          minWidth: "20px",
                          height: "18px",
                          padding: "0 6px",
                          borderRadius: "9px",
                          background: it.countBg,
                          color: C.surface.white,
                          fontSize: "11px",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {it.count}
                      </span>
                    </>
                  ) : null}
                </Hover>
              </Fragment>
            ))}
          </Fragment>
        ))}
        <div
          style={{
            marginTop: "auto",
            padding: "14px 18px",
            borderTop: `1px solid ${C.chrome.hover}`,
            display: "flex",
            gap: "10px",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              background: C.chrome.selected,
              color: C.brand.onDark,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontWeight: "600",
              flexShrink: "0",
            }}
          >
            {meIni}
          </div>
          <div style={{ minWidth: "0", lineHeight: "1.35" }}>
            <div
              style={{
                color: C.surface.white,
                fontSize: "13px",
                fontWeight: "500",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {meName}
            </div>
            <div style={{ fontSize: "11px", color: C.chrome.textFaint }}>{meTitle}</div>
            <div
              style={{
                fontSize: "11px",
                color: C.chrome.textFaint,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {meScope}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
