/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import { Fragment, useEffect, useRef, useState } from "react";
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
  // Keyboard navigation (the footer promises it): ↑/↓ move through the results across groups, Enter opens the active one.
  // Esc is handled for every overlay by use-overlay-dismissal. The active row restarts at the top whenever the results change.
  const flat: any[] = (searchGroups || []).flatMap((g: any) => g.items || []);
  const signature = flat.map((it) => `${it.title}|${it.sub}`).join("||");
  const [active, setActive] = useState(0);
  const list = useRef<HTMLDivElement | null>(null);
  useEffect(() => setActive(0), [signature]);
  const at = Math.min(active, Math.max(flat.length - 1, 0));
  useEffect(() => {
    list.current
      ?.querySelector<HTMLElement>(`[data-hit="${at}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [at, signature]);
  const onKeyDown = (e: { key: string; preventDefault(): void }) => {
    if (!flat.length) return;
    const go = (n: number) => {
      e.preventDefault();
      setActive(n);
    };
    if (e.key === "ArrowDown") go((at + 1) % flat.length);
    else if (e.key === "ArrowUp") go((at - 1 + flat.length) % flat.length);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(flat.length - 1);
    else if (e.key === "Enter") {
      e.preventDefault();
      flat[at]?.go();
    }
  };
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
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded={flat.length > 0}
            aria-controls="search-hits"
            aria-autocomplete="list"
            aria-activedescendant={flat.length ? `search-hit-${at}` : undefined}
            autoComplete="off"
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
        <div ref={list} id="search-hits" role="listbox" style={{ overflowY: "auto", flex: "1" }}>
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
          {(() => {
            let n = -1;
            return (searchGroups || []).map((g: any, __i: number) => (
              <Fragment key={__i}>
                <div role="group" aria-label={g.label}>
                  <div
                    style={{ fontSize: "11.5px", color: C.text.muted, padding: "10px 18px 4px" }}
                  >
                    {g.label}
                  </div>
                  {(g.items || []).map((it: any, __j: number) => {
                    const idx = ++n;
                    const on = idx === at;
                    return (
                      <Fragment key={__j}>
                        <Hover
                          as="button"
                          id={`search-hit-${idx}`}
                          data-hit={idx}
                          role="option"
                          aria-selected={on}
                          tabIndex={-1}
                          onClick={it.go}
                          onMouseMove={() => (on ? undefined : setActive(idx))}
                          style={{
                            width: "100%",
                            display: "flex",
                            gap: "12px",
                            alignItems: "center",
                            padding: "9px 18px",
                            border: "0",
                            borderInlineStart: `3px solid ${on ? C.brand.primary : "transparent"}`,
                            background: on ? C.brand.washAlt : it.bg,
                            cursor: "pointer",
                            textAlign: "start",
                          }}
                          hover={{ background: C.brand.washAlt }}
                        >
                          <span style={{ flex: "1", minWidth: "0" }}>
                            <span
                              style={{ display: "block", fontWeight: "500", fontSize: "13.5px" }}
                            >
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
                    );
                  })}
                </div>
              </Fragment>
            ));
          })()}
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
