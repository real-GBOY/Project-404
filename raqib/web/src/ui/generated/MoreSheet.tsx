/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import { Fragment } from "react";
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";

export function MoreSheet({ vm }: { vm: VM }) {
  const { closeMore, moreItems } = vm;
  return (
    <>
      <div
        onClick={closeMore}
        style={{ position: "absolute", inset: "0", background: C.scrim.medium, zIndex: "30" }}
        aria-hidden="true"
      ></div>
      <div
        style={{
          position: "absolute",
          insetInline: "0",
          bottom: "62px",
          background: C.surface.white,
          borderRadius: "10px 10px 0 0",
          zIndex: "31",
          padding: "8px 0",
          maxHeight: "70%",
          overflowY: "auto",
        }}
      >
        {(moreItems || []).map((it: any, __i: number) => (
          <Fragment key={__i}>
            <button
              onClick={it.go}
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0 20px",
                height: "52px",
                border: "0",
                borderBottom: `1px solid ${C.surface.subtle}`,
                background: C.surface.white,
                color: it.mfg,
                fontSize: "15px",
                cursor: "pointer",
                textAlign: "start",
              }}
            >
              <span>{it.label}</span>
              {it.hasCount ? (
                <>
                  <span
                    style={{
                      minWidth: "22px",
                      height: "20px",
                      padding: "0 6px",
                      borderRadius: "10px",
                      background: it.countBg,
                      color: C.surface.white,
                      fontSize: "11px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {it.count}
                  </span>
                </>
              ) : null}
            </button>
          </Fragment>
        ))}
      </div>
    </>
  );
}
