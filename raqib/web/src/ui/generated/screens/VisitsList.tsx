/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import { Fragment } from "react";
import { Hover } from "@/components/Hover";
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";
import { FONT } from "@/styles/typography";

export function VisitsList({ vm }: { vm: VM }) {
  const { mobile, notMobile, pad, pageTitle, t, vl } = vm;
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
            <div style={{ fontSize: "13px", color: C.text.secondary }}>{vl.count}</div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <div
              style={{
                display: "flex",
                border: `1px solid ${C.border.input}`,
                borderRadius: "4px",
                overflow: "hidden",
                background: C.surface.white,
              }}
            >
              {(vl.views || []).map((o: any, __i: number) => (
                <Fragment key={__i}>
                  <button
                    onClick={o.set}
                    style={{
                      border: "0",
                      height: "36px",
                      padding: "0 14px",
                      fontSize: "13px",
                      cursor: "pointer",
                      background: o.bg,
                      color: o.fg,
                    }}
                  >
                    {o.label}
                  </button>
                </Fragment>
              ))}
            </div>
            {vl.canSchedule ? (
              <>
                <button
                  onClick={vl.create}
                  style={{
                    height: "38px",
                    padding: "0 16px",
                    border: "0",
                    borderRadius: "4px",
                    background: C.brand.primary,
                    color: C.surface.white,
                    fontWeight: "500",
                    cursor: "pointer",
                  }}
                >
                  {t.newVisit}
                </button>
              </>
            ) : null}
          </div>
        </div>
        {vl.isList ? (
          <>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {(vl.chips || []).map((c: any, __i: number) => (
                <Fragment key={__i}>
                  <button
                    onClick={c.go}
                    style={{
                      height: "32px",
                      padding: "0 12px",
                      borderRadius: "16px",
                      border: `1px solid ${c.bd}`,
                      background: c.bg,
                      color: c.fg,
                      fontSize: "12.5px",
                      cursor: "pointer",
                    }}
                  >
                    {c.label}
                  </button>
                </Fragment>
              ))}
            </div>
            {vl.has ? (
              <>
                {notMobile ? (
                  <>
                    <div
                      style={{
                        background: C.surface.white,
                        border: `1px solid ${C.border.hairline}`,
                        borderRadius: "6px",
                        overflowX: "auto",
                      }}
                    >
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          fontSize: "13.5px",
                          minWidth: "900px",
                        }}
                      >
                        <thead>
                          <tr style={{ background: C.surface.paper }}>
                            <th
                              style={{
                                textAlign: "start",
                                fontWeight: "500",
                                fontSize: "12px",
                                color: C.text.secondary,
                                padding: "10px 14px",
                                borderBottom: `1px solid ${C.border.hairline}`,
                              }}
                            >
                              {t.c_ref}
                            </th>
                            <th
                              style={{
                                textAlign: "start",
                                fontWeight: "500",
                                fontSize: "12px",
                                color: C.text.secondary,
                                padding: "10px 14px",
                                borderBottom: `1px solid ${C.border.hairline}`,
                              }}
                            >
                              {t.c_projSite}
                            </th>
                            <th
                              style={{
                                textAlign: "start",
                                fontWeight: "500",
                                fontSize: "12px",
                                color: C.text.secondary,
                                padding: "10px 14px",
                                borderBottom: `1px solid ${C.border.hairline}`,
                              }}
                            >
                              {t.f_inspector}
                            </th>
                            <th
                              style={{
                                textAlign: "start",
                                fontWeight: "500",
                                fontSize: "12px",
                                color: C.text.secondary,
                                padding: "10px 14px",
                                borderBottom: `1px solid ${C.border.hairline}`,
                              }}
                            >
                              {t.f_type}
                            </th>
                            <th
                              style={{
                                textAlign: "start",
                                fontWeight: "500",
                                fontSize: "12px",
                                color: C.text.secondary,
                                padding: "10px 14px",
                                borderBottom: `1px solid ${C.border.hairline}`,
                              }}
                            >
                              {t.f_shift}
                            </th>
                            <th
                              style={{
                                textAlign: "start",
                                fontWeight: "500",
                                fontSize: "12px",
                                color: C.text.secondary,
                                padding: "10px 14px",
                                borderBottom: `1px solid ${C.border.hairline}`,
                              }}
                            >
                              {t.f_datetime}
                            </th>
                            <th
                              style={{
                                textAlign: "start",
                                fontWeight: "500",
                                fontSize: "12px",
                                color: C.text.secondary,
                                padding: "10px 14px",
                                borderBottom: `1px solid ${C.border.hairline}`,
                              }}
                            >
                              {t.c_score}
                            </th>
                            <th
                              style={{
                                textAlign: "start",
                                fontWeight: "500",
                                fontSize: "12px",
                                color: C.text.secondary,
                                padding: "10px 14px",
                                borderBottom: `1px solid ${C.border.hairline}`,
                              }}
                            >
                              {t.c_st}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(vl.rows || []).map((v: any, __i: number) => (
                            <Fragment key={__i}>
                              <Hover
                                as="tr"
                                onClick={v.go}
                                style={{ cursor: "pointer" }}
                                hover={{ background: C.surface.paper }}
                              >
                                <td
                                  style={{
                                    padding: "11px 14px",
                                    borderBottom: `1px solid ${C.surface.track}`,
                                    fontFamily: FONT.mono,
                                    fontSize: "12.5px",
                                  }}
                                >
                                  {v.ref}
                                </td>
                                <td
                                  style={{
                                    padding: "11px 14px",
                                    borderBottom: `1px solid ${C.surface.track}`,
                                  }}
                                >
                                  <div style={{ fontWeight: "500" }}>
                                    {v.site} — {v.area}
                                  </div>
                                  <div style={{ fontSize: "12px", color: C.text.muted }}>
                                    {v.proj}
                                  </div>
                                </td>
                                <td
                                  style={{
                                    padding: "11px 14px",
                                    borderBottom: `1px solid ${C.surface.track}`,
                                  }}
                                >
                                  {v.ins}
                                </td>
                                <td
                                  style={{
                                    padding: "11px 14px",
                                    borderBottom: `1px solid ${C.surface.track}`,
                                  }}
                                >
                                  {v.type}
                                </td>
                                <td
                                  style={{
                                    padding: "11px 14px",
                                    borderBottom: `1px solid ${C.surface.track}`,
                                  }}
                                >
                                  {v.shift}
                                </td>
                                <td
                                  style={{
                                    padding: "11px 14px",
                                    borderBottom: `1px solid ${C.surface.track}`,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {v.wd} {v.date} ·
                                  <span
                                    dir="ltr"
                                    style={{ fontFamily: FONT.mono, fontSize: "12.5px" }}
                                  >
                                    {v.time}
                                  </span>
                                </td>
                                <td
                                  style={{
                                    padding: "11px 14px",
                                    borderBottom: `1px solid ${C.surface.track}`,
                                    fontWeight: "600",
                                    color: v.scoreC,
                                  }}
                                >
                                  {v.score}
                                </td>
                                <td
                                  style={{
                                    padding: "11px 14px",
                                    borderBottom: `1px solid ${C.surface.track}`,
                                  }}
                                >
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "6px",
                                      height: "22px",
                                      padding: "0 8px",
                                      borderRadius: "3px",
                                      fontSize: "12px",
                                      fontWeight: "500",
                                      whiteSpace: "nowrap",
                                      color: v.st.fg,
                                      background: v.st.bg,
                                    }}
                                  >
                                    <span
                                      style={{
                                        width: "6px",
                                        height: "6px",
                                        borderRadius: "50%",
                                        background: v.st.fg,
                                      }}
                                    ></span>
                                    {v.st.label}
                                  </span>
                                </td>
                              </Hover>
                            </Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : null}
                {mobile ? (
                  <>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {(vl.rows || []).map((v: any, __i: number) => (
                        <Fragment key={__i}>
                          <button
                            onClick={v.go}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "6px",
                              padding: "14px",
                              border: `1px solid ${C.border.hairline}`,
                              borderRadius: "6px",
                              background: C.surface.white,
                              cursor: "pointer",
                              textAlign: "start",
                            }}
                          >
                            <span
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: "8px",
                                width: "100%",
                                alignItems: "center",
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: FONT.mono,
                                  fontSize: "12px",
                                  color: C.text.secondary,
                                }}
                              >
                                {v.ref}
                              </span>
                              <span
                                style={{
                                  height: "22px",
                                  padding: "0 8px",
                                  borderRadius: "3px",
                                  fontSize: "12px",
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
                            <span style={{ fontWeight: "600" }}>
                              {v.site} — {v.area}
                            </span>
                            <span style={{ fontSize: "12.5px", color: C.text.secondary }}>
                              {v.wd} {v.date} · {v.time} · {v.shift}
                            </span>
                          </button>
                        </Fragment>
                      ))}
                    </div>
                  </>
                ) : null}
              </>
            ) : null}
            {vl.none ? (
              <>
                <div
                  style={{
                    background: C.surface.white,
                    border: `1px dashed ${C.border.input}`,
                    borderRadius: "6px",
                    padding: "36px 20px",
                    textAlign: "center",
                    color: C.text.secondary,
                  }}
                >
                  {t.noVisitsFilter}
                </div>
              </>
            ) : null}
          </>
        ) : null}
        {vl.isWeek ? (
          <>
            <div style={{ fontSize: "13px", color: C.text.secondary }}>{vl.weekLabel}</div>
            {notMobile ? (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7,minmax(0,1fr))",
                    background: C.surface.white,
                    border: `1px solid ${C.border.hairline}`,
                    borderRadius: "6px",
                    overflow: "hidden",
                    minHeight: "420px",
                  }}
                >
                  {(vl.days || []).map((d: any, __i: number) => (
                    <Fragment key={__i}>
                      <div
                        style={{
                          borderInlineEnd: `1px solid ${C.surface.track}`,
                          display: "flex",
                          flexDirection: "column",
                          minWidth: "0",
                        }}
                      >
                        <div
                          style={{
                            padding: "10px",
                            borderBottom: `1px solid ${C.surface.track}`,
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <span style={{ fontSize: "12px", color: C.text.secondary }}>{d.wd}</span>
                          <span
                            style={{
                              minWidth: "26px",
                              height: "26px",
                              borderRadius: "13px",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: "600",
                              background: d.hbg,
                              color: d.hfg,
                            }}
                          >
                            {d.dn}
                          </span>
                        </div>
                        <div
                          style={{
                            padding: "6px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                          }}
                        >
                          {(d.items || []).map((v: any, __i: number) => (
                            <Fragment key={__i}>
                              <button
                                onClick={v.go}
                                style={{
                                  textAlign: "start",
                                  border: `1px solid ${C.border.hairline}`,
                                  borderTop: `3px solid ${v.bar}`,
                                  borderRadius: "3px",
                                  background: C.surface.paper,
                                  padding: "6px 8px",
                                  cursor: "pointer",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "1px",
                                  fontSize: "12px",
                                  minWidth: "0",
                                }}
                              >
                                <span
                                  dir="ltr"
                                  style={{
                                    fontFamily: FONT.mono,
                                    fontWeight: "500",
                                    textAlign: "start",
                                  }}
                                >
                                  {v.time}
                                </span>
                                <span
                                  style={{
                                    fontWeight: "500",
                                    fontSize: "12.5px",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {v.site}
                                </span>
                                <span
                                  style={{
                                    color: C.text.secondary,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {v.ins}
                                </span>
                                <span style={{ color: v.st.fg }}>{v.st.label}</span>
                              </button>
                            </Fragment>
                          ))}
                        </div>
                      </div>
                    </Fragment>
                  ))}
                </div>
              </>
            ) : null}
            {mobile ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {(vl.days || []).map((d: any, __i: number) => (
                    <Fragment key={__i}>
                      <div>
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: "600",
                            padding: "4px 0",
                            color: d.hbg,
                          }}
                        >
                          {d.full}
                        </div>
                        {(d.items || []).map((v: any, __i: number) => (
                          <Fragment key={__i}>
                            <button
                              onClick={v.go}
                              style={{
                                width: "100%",
                                display: "flex",
                                gap: "12px",
                                alignItems: "center",
                                padding: "12px",
                                border: `1px solid ${C.border.hairline}`,
                                borderInlineStart: `3px solid ${v.bar}`,
                                borderRadius: "4px",
                                background: C.surface.white,
                                cursor: "pointer",
                                textAlign: "start",
                                marginTop: "6px",
                              }}
                            >
                              <span dir="ltr" style={{ fontFamily: FONT.mono }}>
                                {v.time}
                              </span>
                              <span style={{ flex: "1" }}>
                                <span style={{ display: "block", fontWeight: "500" }}>
                                  {v.site}
                                </span>
                                <span
                                  style={{
                                    display: "block",
                                    fontSize: "12px",
                                    color: C.text.secondary,
                                  }}
                                >
                                  {v.st.label}
                                </span>
                              </span>
                            </button>
                          </Fragment>
                        ))}
                        {d.empty ? (
                          <>
                            <div
                              style={{ fontSize: "12.5px", color: C.text.muted, padding: "4px 0" }}
                            >
                              {t.noVisitsDay}
                            </div>
                          </>
                        ) : null}
                      </div>
                    </Fragment>
                  ))}
                </div>
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </>
  );
}
