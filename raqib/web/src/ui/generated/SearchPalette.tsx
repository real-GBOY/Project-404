/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import { Fragment } from "react";
import { Hover } from "@/components/Hover";
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";
import { FONT } from "@/styles/typography";

export function SearchPalette({ vm }: { vm: VM }) {
  const {
    closeSearch,
    confHit,
    dir,
    notMobile,
    onQ,
    q,
    recent,
    searchGroups,
    searchNone,
    searchRecent,
    searchRef,
    searchScope,
    searchW,
    t,
  } = vm;
  return (
    <>
      <div
        onClick={closeSearch}
        style={{ position: "absolute", inset: "0", background: C.scrim.light, zIndex: "50" }}
        aria-hidden="true"
      ></div>
      <div
        dir={dir}
        style={{
          position: "absolute",
          top: "56px",
          left: "50%",
          transform: "translateX(-50%)",
          width: searchW,
          maxHeight: "calc(100% - 90px)",
          background: C.surface.white,
          borderRadius: "6px",
          zIndex: "51",
          display: "flex",
          flexDirection: "column",
          boxShadow: `0 20px 50px ${C.shadow.popover}`,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "12px", borderBottom: `1px solid ${C.border.hairline}` }}>
          <input
            ref={searchRef}
            value={q}
            onChange={onQ}
            placeholder={t.searchPh}
            style={{
              width: "100%",
              height: "44px",
              border: "0",
              fontSize: "16px",
              padding: "0 6px",
              outline: "none",
            }}
          />
        </div>
        <div
          style={{
            fontSize: "11.5px",
            color: C.text.muted,
            padding: "8px 18px",
            background: C.surface.paper,
            borderBottom: `1px solid ${C.surface.track}`,
          }}
        >
          {searchScope}
        </div>
        <div style={{ overflowY: "auto", flex: "1" }}>
          {searchRecent ? (
            <>
              <div style={{ padding: "12px 18px" }}>
                <div style={{ fontSize: "12px", color: C.text.muted, marginBottom: "6px" }}>
                  {t.recentSearches}
                </div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {(recent || []).map((r: any, __i: number) => (
                    <Fragment key={__i}>
                      <button
                        onClick={r.set}
                        style={{
                          height: "30px",
                          padding: "0 10px",
                          border: `1px solid ${C.border.input}`,
                          borderRadius: "15px",
                          background: C.surface.white,
                          fontSize: "12.5px",
                          cursor: "pointer",
                        }}
                      >
                        {r.label}
                      </button>
                    </Fragment>
                  ))}
                </div>
              </div>
            </>
          ) : null}
          {(searchGroups || []).map((g: any, __i: number) => (
            <Fragment key={__i}>
              <div>
                <div style={{ fontSize: "11.5px", color: C.text.muted, padding: "10px 18px 4px" }}>
                  {g.label}
                </div>
                {(g.items || []).map((it: any, __i: number) => (
                  <Fragment key={__i}>
                    <Hover
                      as="button"
                      onClick={it.go}
                      style={{
                        width: "100%",
                        display: "flex",
                        gap: "12px",
                        alignItems: "center",
                        padding: "9px 18px",
                        border: "0",
                        background: it.bg,
                        cursor: "pointer",
                        textAlign: "start",
                      }}
                      hover={{ background: C.brand.washAlt }}
                    >
                      <span style={{ flex: "1", minWidth: "0" }}>
                        <span style={{ display: "block", fontWeight: "500", fontSize: "13.5px" }}>
                          {it.title}
                        </span>
                        <span
                          style={{
                            display: "block",
                            fontSize: "12px",
                            color: C.text.secondary,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {it.sub}
                        </span>
                      </span>
                      <span style={{ fontSize: "11px", color: C.text.muted }}>{it.kind}</span>
                    </Hover>
                  </Fragment>
                ))}
              </div>
            </Fragment>
          ))}
          {searchNone ? (
            <>
              <div style={{ padding: "28px 18px", textAlign: "center", color: C.text.secondary }}>
                {t.noSearchResults}
              </div>
            </>
          ) : null}
          {confHit ? (
            <>
              <div
                style={{
                  margin: "8px 18px 14px",
                  padding: "10px 12px",
                  background: C.status.danger.bgWash,
                  color: C.status.danger.deep,
                  borderRadius: "4px",
                  fontSize: "12.5px",
                }}
              >
                {t.confNotSearchable}
              </div>
            </>
          ) : null}
        </div>
        {notMobile ? (
          <>
            <div
              dir="ltr"
              style={{
                display: "flex",
                gap: "16px",
                padding: "8px 18px",
                borderTop: `1px solid ${C.surface.track}`,
                fontSize: "11px",
                color: C.text.muted,
                fontFamily: FONT.mono,
              }}
            >
              <span>↑↓ navigate</span>
              <span>Enter open</span>
              <span>Esc close</span>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
