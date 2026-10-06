/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import { Fragment } from "react";
import { Hover } from "@/components/Hover";
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";
import { FONT } from "@/styles/typography";

export function UsersList({ vm }: { vm: VM }) {
  const { pad, pageTitle, t, ul } = vm;
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
        <div>
          <h1 style={{ margin: "0", fontSize: "22px", fontWeight: "600" }}>{pageTitle}</h1>
          <div style={{ fontSize: "13px", color: C.text.secondary }}>{t.usersSub}</div>
        </div>
        <div
          style={{ display: "flex", gap: "4px", borderBottom: `1px solid ${C.border.hairline}` }}
        >
          {(ul.tabs || []).map((tb: any, __i: number) => (
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
                  }}
                >
                  {tb.n}
                </span>
              </button>
            </Fragment>
          ))}
        </div>
        {ul.isUsers ? (
          <>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <input
                value={ul.q}
                onChange={ul.onQ}
                placeholder={t.userSearchPh}
                style={{
                  height: "38px",
                  flex: "1",
                  minWidth: "200px",
                  maxWidth: "360px",
                  border: `1px solid ${C.border.input}`,
                  borderRadius: "4px",
                  padding: "0 12px",
                  fontSize: "14px",
                }}
              />
              <select
                value={ul.role}
                onChange={ul.onRole}
                style={{
                  height: "38px",
                  border: `1px solid ${C.border.input}`,
                  borderRadius: "4px",
                  padding: "0 10px",
                  fontSize: "13.5px",
                  background: C.surface.white,
                }}
              >
                {(ul.roleOpts || []).map((o: any, __i: number) => (
                  <Fragment key={__i}>
                    <option value={o.v}>{o.l}</option>
                  </Fragment>
                ))}
              </select>
            </div>
            <section
              style={{
                background: C.surface.white,
                border: `1px solid ${C.border.hairline}`,
                borderRadius: "6px",
              }}
            >
              {(ul.rows || []).map((u: any, __i: number) => (
                <Fragment key={__i}>
                  <Hover
                    as="button"
                    onClick={u.go}
                    style={{
                      width: "100%",
                      display: "flex",
                      gap: "10px 16px",
                      alignItems: "center",
                      padding: "12px 18px",
                      border: "0",
                      borderBottom: `1px solid ${C.surface.track}`,
                      background: C.surface.white,
                      cursor: "pointer",
                      textAlign: "start",
                      flexWrap: "wrap",
                    }}
                    hover={{ background: C.surface.paper }}
                  >
                    <span
                      style={{
                        width: "34px",
                        height: "34px",
                        borderRadius: "50%",
                        background: C.surface.sunken,
                        fontSize: "12px",
                        fontWeight: "600",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: "0",
                      }}
                    >
                      {u.ini}
                    </span>
                    <span style={{ flex: "1", minWidth: "200px" }}>
                      <span style={{ display: "block", fontWeight: "500" }}>{u.name}</span>
                      <span style={{ display: "block", fontSize: "12px", color: C.text.muted }}>
                        {u.role} ·<span dir="ltr">{u.email}</span>
                      </span>
                    </span>
                    <span
                      style={{ fontSize: "12px", color: C.text.secondary, fontFamily: FONT.mono }}
                    >
                      {u.scope}
                    </span>
                    <span style={{ fontSize: "12px", color: C.text.secondary, minWidth: "110px" }}>
                      {u.last}
                    </span>
                    <span
                      style={{
                        height: "22px",
                        padding: "0 8px",
                        borderRadius: "3px",
                        fontSize: "12px",
                        fontWeight: "500",
                        color: u.st.fg,
                        background: u.st.bg,
                        display: "inline-flex",
                        alignItems: "center",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {u.st.label}
                    </span>
                  </Hover>
                </Fragment>
              ))}
              {ul.none ? (
                <>
                  <div style={{ padding: "28px", textAlign: "center", color: C.text.secondary }}>
                    {t.noResults}
                  </div>
                </>
              ) : null}
            </section>
          </>
        ) : null}
        {ul.isReqs ? (
          <>
            <div
              style={{
                fontSize: "12.5px",
                color: C.text.body,
                background: C.surface.sunken,
                borderRadius: "4px",
                padding: "10px 12px",
              }}
            >
              {t.accFlow}
            </div>
            <section
              style={{
                background: C.surface.white,
                border: `1px solid ${C.border.hairline}`,
                borderRadius: "6px",
              }}
            >
              {(ul.reqs || []).map((r: any, __i: number) => (
                <Fragment key={__i}>
                  <Hover
                    as="button"
                    onClick={r.go}
                    style={{
                      width: "100%",
                      display: "flex",
                      gap: "10px 16px",
                      alignItems: "center",
                      padding: "13px 18px",
                      border: "0",
                      borderBottom: `1px solid ${C.surface.track}`,
                      background: C.surface.white,
                      cursor: "pointer",
                      textAlign: "start",
                      flexWrap: "wrap",
                    }}
                    hover={{ background: C.surface.paper }}
                  >
                    <span style={{ fontFamily: FONT.mono, fontSize: "12.5px", minWidth: "110px" }}>
                      {r.ref}
                    </span>
                    <span style={{ flex: "1", minWidth: "200px" }}>
                      <span style={{ display: "block", fontWeight: "500" }}>{r.name}</span>
                      <span style={{ display: "block", fontSize: "12px", color: C.text.muted }}>
                        {r.role} · {r.proj}
                      </span>
                    </span>
                    <span style={{ fontSize: "12px", color: C.text.secondary }}>{r.at}</span>
                    <span
                      style={{
                        height: "22px",
                        padding: "0 8px",
                        borderRadius: "3px",
                        fontSize: "12px",
                        fontWeight: "500",
                        color: r.st.fg,
                        background: r.st.bg,
                        display: "inline-flex",
                        alignItems: "center",
                      }}
                    >
                      {r.st.label}
                    </span>
                  </Hover>
                </Fragment>
              ))}
            </section>
          </>
        ) : null}
      </div>
    </>
  );
}
