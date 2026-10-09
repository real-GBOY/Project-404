/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import { Fragment } from "react";
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";
import { FONT } from "@/styles/typography";

export function ModalFields({ vm }: { vm: VM }) {
  const { md, t } = vm;
  return (
    <>
      {md.isReturn ? (
        <>
          {md.hasFlags ? (
            <>
              <div style={{ fontSize: "13px" }}>
                <div style={{ fontWeight: "500", marginBottom: "4px" }}>{t.flaggedItems}</div>
                {(md.flags || []).map((f: any, __i: number) => (
                  <Fragment key={__i}>
                    <div style={{ display: "flex", gap: "8px", padding: "4px 0" }}>
                      <span style={{ fontFamily: FONT.mono, color: C.status.warning.fg }}>
                        {f.num}
                      </span>
                      <span>{f.text}</span>
                    </div>
                  </Fragment>
                ))}
              </div>
            </>
          ) : null}
          {md.noFlags ? (
            <>
              <div
                style={{
                  fontSize: "12.5px",
                  color: C.status.warning.strong,
                  background: C.status.warning.bg,
                  padding: "8px 10px",
                  borderRadius: "4px",
                }}
              >
                {t.noFlagsWarn}
              </div>
            </>
          ) : null}
        </>
      ) : null}
      {md.isSubmit ? (
        <>
          <div
            style={{
              fontSize: "13.5px",
              background: C.surface.paper,
              borderRadius: "4px",
              padding: "10px 12px",
            }}
          >
            {md.summary}
          </div>
        </>
      ) : null}
      {md.isApprove ? (
        <>
          <div
            style={{
              fontSize: "13.5px",
              background: C.surface.paper,
              borderRadius: "4px",
              padding: "10px 12px",
            }}
          >
            {md.summary}
            <div style={{ fontSize: "12.5px", color: C.text.secondary, marginTop: "4px" }}>
              {t.approveGenerates}
              <span style={{ fontFamily: FONT.mono }}>{md.reportRef}</span>
            </div>
          </div>
        </>
      ) : null}
      {md.isCreate ? (
        <>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "5px",
              fontSize: "13px",
              fontWeight: "500",
            }}
          >
            {t.f_project}
            <select
              value={md.p.val}
              onChange={md.p.on}
              style={{
                height: "40px",
                border: `1px solid ${md.p.bd}`,
                borderRadius: "4px",
                padding: "0 10px",
                fontSize: "14px",
                background: C.surface.white,
              }}
            >
              {(md.pOpts || []).map((o: any, __i: number) => (
                <Fragment key={__i}>
                  <option value={o.v}>{o.l}</option>
                </Fragment>
              ))}
            </select>
          </label>
          <div
            style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "10px" }}
          >
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "5px",
                fontSize: "13px",
                fontWeight: "500",
              }}
            >
              {t.f_site}
              <select
                value={md.s.val}
                onChange={md.s.on}
                style={{
                  height: "40px",
                  border: `1px solid ${md.s.bd}`,
                  borderRadius: "4px",
                  padding: "0 10px",
                  fontSize: "14px",
                  background: C.surface.white,
                }}
              >
                {(md.sOpts || []).map((o: any, __i: number) => (
                  <Fragment key={__i}>
                    <option value={o.v}>{o.l}</option>
                  </Fragment>
                ))}
              </select>
            </label>
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "5px",
                fontSize: "13px",
                fontWeight: "500",
              }}
            >
              {t.f_area}
              {(md.areaOpts || []).length > 1 ? (
                <>
                  <select
                    value={md.areaId.val}
                    onChange={md.areaId.on}
                    style={{
                      height: "40px",
                      border: `1px solid ${C.border.input}`,
                      borderRadius: "4px",
                      padding: "0 10px",
                      fontSize: "14px",
                      background: C.surface.white,
                    }}
                  >
                    {(md.areaOpts || []).map((o: any, __i: number) => (
                      <Fragment key={__i}>
                        <option value={o.v}>{o.l}</option>
                      </Fragment>
                    ))}
                  </select>
                </>
              ) : null}
              <input
                value={md.area.val}
                onChange={md.area.on}
                style={{
                  height: "40px",
                  border: `1px solid ${C.border.input}`,
                  borderRadius: "4px",
                  padding: "0 10px",
                  fontSize: "14px",
                }}
              />
            </label>
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "5px",
                fontSize: "13px",
                fontWeight: "500",
              }}
            >
              {t.f_type}
              <select
                value={md.type.val}
                onChange={md.type.on}
                style={{
                  height: "40px",
                  border: `1px solid ${C.border.input}`,
                  borderRadius: "4px",
                  padding: "0 10px",
                  fontSize: "14px",
                  background: C.surface.white,
                }}
              >
                {(md.typeOpts || []).map((o: any, __i: number) => (
                  <Fragment key={__i}>
                    <option value={o.v}>{o.l}</option>
                  </Fragment>
                ))}
              </select>
            </label>
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "5px",
                fontSize: "13px",
                fontWeight: "500",
              }}
            >
              {t.f_shift}
              <select
                value={md.shift.val}
                onChange={md.shift.on}
                style={{
                  height: "40px",
                  border: `1px solid ${C.border.input}`,
                  borderRadius: "4px",
                  padding: "0 10px",
                  fontSize: "14px",
                  background: C.surface.white,
                }}
              >
                {(md.shiftOpts || []).map((o: any, __i: number) => (
                  <Fragment key={__i}>
                    <option value={o.v}>{o.l}</option>
                  </Fragment>
                ))}
              </select>
            </label>
          </div>
          {md.hasFormChecks ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                fontSize: "13px",
                fontWeight: "500",
              }}
            >
              {t.f_forms}
              <span style={{ fontWeight: "400", color: C.text.secondary, fontSize: "12px" }}>
                {t.f_formsHint}
              </span>
              {(md.formChecks || []).map((fc: any, __i: number) => (
                <Fragment key={__i}>
                  <label
                    style={{
                      display: "flex",
                      gap: "10px",
                      alignItems: "center",
                      minHeight: "34px",
                      fontWeight: "400",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={fc.on}
                      onChange={fc.toggle}
                      style={{ width: "18px", height: "18px", accentColor: C.brand.primary }}
                    />
                    {fc.label}
                  </label>
                </Fragment>
              ))}
            </div>
          ) : null}
          {md.hasGuardChecks ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                fontSize: "13px",
                fontWeight: "500",
              }}
            >
              {t.f_guardsOnShift}
              <span style={{ fontWeight: "400", color: C.text.secondary, fontSize: "12px" }}>
                {t.f_guardsOnShiftHint}
              </span>
              <div style={{ maxHeight: "150px", overflowY: "auto" }}>
                {(md.guardChecks || []).map((gc: any, __i: number) => (
                  <Fragment key={__i}>
                    <label
                      style={{
                        display: "flex",
                        gap: "10px",
                        alignItems: "center",
                        minHeight: "32px",
                        fontWeight: "400",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={gc.on}
                        onChange={gc.toggle}
                        style={{ width: "18px", height: "18px", accentColor: C.brand.primary }}
                      />
                      {gc.label}
                    </label>
                  </Fragment>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
      {md.isSched ? (
        <>
          <div
            style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "10px" }}
          >
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "5px",
                fontSize: "13px",
                fontWeight: "500",
              }}
            >
              {t.f_date}
              <input
                type="date"
                value={md.date.val}
                onChange={md.date.on}
                style={{
                  height: "40px",
                  border: `1px solid ${md.date.bd}`,
                  borderRadius: "4px",
                  padding: "0 10px",
                  fontSize: "14px",
                }}
              />
            </label>
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "5px",
                fontSize: "13px",
                fontWeight: "500",
              }}
            >
              {t.f_time}
              <input
                type="time"
                value={md.time.val}
                onChange={md.time.on}
                style={{
                  height: "40px",
                  border: `1px solid ${md.time.bd}`,
                  borderRadius: "4px",
                  padding: "0 10px",
                  fontSize: "14px",
                }}
              />
            </label>
          </div>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "5px",
              fontSize: "13px",
              fontWeight: "500",
            }}
          >
            {t.f_inspector}
            <select
              value={md.ins.val}
              onChange={md.ins.on}
              style={{
                height: "40px",
                border: `1px solid ${md.ins.bd}`,
                borderRadius: "4px",
                padding: "0 10px",
                fontSize: "14px",
                background: C.surface.white,
              }}
            >
              {(md.insOpts || []).map((o: any, __i: number) => (
                <Fragment key={__i}>
                  <option value={o.v}>{o.l}</option>
                </Fragment>
              ))}
            </select>
          </label>
        </>
      ) : null}
      {md.isCA ? (
        <>
          <div
            style={{
              fontSize: "12.5px",
              color: C.text.secondary,
              background: C.surface.paper,
              borderRadius: "4px",
              padding: "8px 10px",
            }}
          >
            {t.f_source}: {md.source}
          </div>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "5px",
              fontSize: "13px",
              fontWeight: "500",
            }}
          >
            {t.caTitle}
            <input
              value={md.title2.val}
              onChange={md.title2.on}
              style={{
                height: "40px",
                border: `1px solid ${md.title2.bd}`,
                borderRadius: "4px",
                padding: "0 10px",
                fontSize: "14px",
              }}
            />
          </label>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "5px",
              fontSize: "13px",
              fontWeight: "500",
            }}
          >
            {t.f_resp}
            <select
              value={md.resp.val}
              onChange={md.resp.on}
              style={{
                height: "40px",
                border: `1px solid ${md.resp.bd}`,
                borderRadius: "4px",
                padding: "0 10px",
                fontSize: "14px",
                background: C.surface.white,
              }}
            >
              {(md.respOpts || []).map((o: any, __i: number) => (
                <Fragment key={__i}>
                  <option value={o.v}>{o.l}</option>
                </Fragment>
              ))}
            </select>
          </label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2,minmax(0,1fr))",
              gap: "10px",
              alignItems: "end",
            }}
          >
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "5px",
                fontSize: "13px",
                fontWeight: "500",
              }}
            >
              {t.f_due}
              <input
                type="date"
                value={md.due.val}
                onChange={md.due.on}
                style={{
                  height: "40px",
                  border: `1px solid ${md.due.bd}`,
                  borderRadius: "4px",
                  padding: "0 10px",
                  fontSize: "14px",
                }}
              />
            </label>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "5px",
                fontSize: "13px",
                fontWeight: "500",
              }}
            >
              {t.priority}
              <div
                style={{
                  display: "flex",
                  border: `1px solid ${C.border.input}`,
                  borderRadius: "4px",
                  overflow: "hidden",
                }}
              >
                {(md.priOpts || []).map((o: any, __i: number) => (
                  <Fragment key={__i}>
                    <button
                      onClick={o.set}
                      style={{
                        flex: "1",
                        border: "0",
                        height: "38px",
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
            </div>
          </div>
        </>
      ) : null}
      {md.isTr ? (
        <>
          {md.gPick ? (
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "5px",
                fontSize: "13px",
                fontWeight: "500",
              }}
            >
              {t.k_guard}
              <select
                value={md.g.val}
                onChange={md.g.on}
                style={{
                  height: "40px",
                  border: `1px solid ${md.g.bd}`,
                  borderRadius: "4px",
                  padding: "0 10px",
                  fontSize: "14px",
                  background: C.surface.white,
                  fontWeight: "400",
                }}
              >
                {(md.gOpts || []).map((o: any, __i: number) => (
                  <Fragment key={__i}>
                    <option value={o.v}>{o.l}</option>
                  </Fragment>
                ))}
              </select>
            </label>
          ) : null}
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "5px",
              fontSize: "13px",
              fontWeight: "500",
            }}
          >
            {t.f_trReason}
            <select
              value={md.reason2.val}
              onChange={md.reason2.on}
              style={{
                height: "40px",
                border: `1px solid ${md.reason2.bd}`,
                borderRadius: "4px",
                padding: "0 10px",
                fontSize: "14px",
                background: C.surface.white,
                fontWeight: "400",
              }}
            >
              {(md.reasonOpts || []).map((o: any, __i: number) => (
                <Fragment key={__i}>
                  <option value={o.v}>{o.l}</option>
                </Fragment>
              ))}
            </select>
          </label>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "5px",
              fontSize: "13px",
              fontWeight: "500",
            }}
          >
            {t.f_course}
            <input
              value={md.course.val}
              onChange={md.course.on}
              style={{
                height: "40px",
                border: `1px solid ${md.course.bd}`,
                borderRadius: "4px",
                padding: "0 10px",
                fontSize: "14px",
                fontWeight: "400",
              }}
            />
          </label>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "5px",
              fontSize: "13px",
              fontWeight: "500",
            }}
          >
            {t.f_related}
            <input
              value={md.related.val}
              onChange={md.related.on}
              style={{
                height: "40px",
                border: `1px solid ${md.related.bd}`,
                borderRadius: "4px",
                padding: "0 10px",
                fontSize: "14px",
                fontWeight: "400",
              }}
            />
          </label>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "5px",
              fontSize: "13px",
              fontWeight: "500",
            }}
          >
            {t.priority}
            <div
              style={{
                display: "flex",
                border: `1px solid ${C.border.input}`,
                borderRadius: "4px",
                overflow: "hidden",
              }}
            >
              {(md.priOpts2 || []).map((o: any, __i: number) => (
                <Fragment key={__i}>
                  <button
                    onClick={o.set}
                    style={{
                      flex: "1",
                      border: "0",
                      height: "38px",
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
          </div>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "5px",
              fontSize: "13px",
              fontWeight: "500",
            }}
          >
            {t.c_notes}
            <textarea
              value={md.notes.val}
              onChange={md.notes.on}
              rows={2}
              style={{
                border: `1px solid ${C.border.input}`,
                borderRadius: "4px",
                padding: "10px 12px",
                fontSize: "14px",
                fontWeight: "400",
              }}
            ></textarea>
          </label>
        </>
      ) : null}
      {md.isTrSched ? (
        <>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "5px",
              fontSize: "13px",
              fontWeight: "500",
            }}
          >
            {t.f_date}
            <input
              type="date"
              value={md.date.val}
              onChange={md.date.on}
              style={{
                height: "40px",
                border: `1px solid ${md.date.bd}`,
                borderRadius: "4px",
                padding: "0 10px",
                fontSize: "14px",
                fontWeight: "400",
              }}
            />
          </label>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "5px",
              fontSize: "13px",
              fontWeight: "500",
            }}
          >
            {t.provider}
            <select
              value={md.provider.val}
              onChange={md.provider.on}
              style={{
                height: "40px",
                border: `1px solid ${md.provider.bd}`,
                borderRadius: "4px",
                padding: "0 10px",
                fontSize: "14px",
                background: C.surface.white,
                fontWeight: "400",
              }}
            >
              {(md.provOpts || []).map((o: any, __i: number) => (
                <Fragment key={__i}>
                  <option value={o.v}>{o.l}</option>
                </Fragment>
              ))}
            </select>
          </label>
        </>
      ) : null}
      {md.isTrDone ? (
        <>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "5px",
              fontSize: "13px",
              fontWeight: "500",
            }}
          >
            {t.f_date}
            <input
              type="date"
              value={md.date.val}
              onChange={md.date.on}
              style={{
                height: "40px",
                border: `1px solid ${md.date.bd}`,
                borderRadius: "4px",
                padding: "0 10px",
                fontSize: "14px",
                fontWeight: "400",
              }}
            />
          </label>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "5px",
              fontSize: "13px",
              fontWeight: "500",
            }}
          >
            {t.result}
            <div
              style={{
                display: "flex",
                border: `1px solid ${C.border.input}`,
                borderRadius: "4px",
                overflow: "hidden",
              }}
            >
              {(md.resOpts || []).map((o: any, __i: number) => (
                <Fragment key={__i}>
                  <button
                    onClick={o.set}
                    style={{
                      flex: "1",
                      border: "0",
                      height: "38px",
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
          </div>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "5px",
              fontSize: "13px",
              fontWeight: "500",
            }}
          >
            {t.c_notes}
            <input
              value={md.note2.val}
              onChange={md.note2.on}
              style={{
                height: "40px",
                border: `1px solid ${md.note2.bd}`,
                borderRadius: "4px",
                padding: "0 10px",
                fontSize: "14px",
                fontWeight: "400",
              }}
            />
          </label>
        </>
      ) : null}
      {md.isRoleSel ? (
        <>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "5px",
              fontSize: "13px",
              fontWeight: "500",
            }}
          >
            {t.c_role}
            <select
              value={md.role.val}
              onChange={md.role.on}
              style={{
                height: "40px",
                border: `1px solid ${md.role.bd}`,
                borderRadius: "4px",
                padding: "0 10px",
                fontSize: "14px",
                background: C.surface.white,
                fontWeight: "400",
              }}
            >
              {(md.roleOpts || []).map((o: any, __i: number) => (
                <Fragment key={__i}>
                  <option value={o.v}>{o.l}</option>
                </Fragment>
              ))}
            </select>
          </label>
        </>
      ) : null}
      {md.isProj ? (
        <>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              fontSize: "13px",
              fontWeight: "500",
            }}
          >
            {t.projectScope}
            {(md.projChecks || []).map((p: any, __i: number) => (
              <Fragment key={__i}>
                <label
                  style={{
                    display: "flex",
                    gap: "10px",
                    alignItems: "center",
                    minHeight: "34px",
                    fontWeight: "400",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={p.on}
                    onChange={p.toggle}
                    style={{ width: "18px", height: "18px", accentColor: C.brand.primary }}
                  />
                  {p.label}
                </label>
              </Fragment>
            ))}
          </div>
        </>
      ) : null}
      {md.isGrantAdd ? (
        <>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "5px",
              fontSize: "13px",
              fontWeight: "500",
            }}
          >
            {t.grantee}
            <select
              value={md.guser.val}
              onChange={md.guser.on}
              style={{
                height: "40px",
                border: `1px solid ${md.guser.bd}`,
                borderRadius: "4px",
                padding: "0 10px",
                fontSize: "14px",
                background: C.surface.white,
                fontWeight: "400",
              }}
            >
              {(md.guserOpts || []).map((o: any, __i: number) => (
                <Fragment key={__i}>
                  <option value={o.v}>{o.l}</option>
                </Fragment>
              ))}
            </select>
          </label>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "5px",
              fontSize: "13px",
              fontWeight: "500",
            }}
          >
            {t.grantLevel}
            <div
              style={{
                display: "flex",
                border: `1px solid ${C.border.input}`,
                borderRadius: "4px",
                overflow: "hidden",
              }}
            >
              {(md.levelOpts || []).map((o: any, __i: number) => (
                <Fragment key={__i}>
                  <button
                    onClick={o.set}
                    style={{
                      flex: "1",
                      border: "0",
                      height: "38px",
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
          </div>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "5px",
              fontSize: "13px",
              fontWeight: "500",
            }}
          >
            {t.grantScope}
            <select
              value={md.gscope.val}
              onChange={md.gscope.on}
              style={{
                height: "40px",
                border: `1px solid ${md.gscope.bd}`,
                borderRadius: "4px",
                padding: "0 10px",
                fontSize: "14px",
                background: C.surface.white,
                fontWeight: "400",
              }}
            >
              {(md.gscopeOpts || []).map((o: any, __i: number) => (
                <Fragment key={__i}>
                  <option value={o.v}>{o.l}</option>
                </Fragment>
              ))}
            </select>
          </label>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "5px",
              fontSize: "13px",
              fontWeight: "500",
            }}
          >
            {t.expires}
            <input
              type="date"
              value={md.expires.val}
              onChange={md.expires.on}
              style={{
                height: "40px",
                border: `1px solid ${md.expires.bd}`,
                borderRadius: "4px",
                padding: "0 10px",
                fontSize: "14px",
                fontWeight: "400",
              }}
            />
          </label>
        </>
      ) : null}
      {md.isNewSection ? (
        <>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "5px",
              fontSize: "13px",
              fontWeight: "500",
            }}
          >
            {t.sectionName}
            <input
              value={md.title2.val}
              onChange={md.title2.on}
              style={{
                height: "40px",
                border: `1px solid ${md.title2.bd}`,
                borderRadius: "4px",
                padding: "0 10px",
                fontSize: "14px",
                fontWeight: "400",
              }}
            />
          </label>
        </>
      ) : null}
      {md.hasAffect ? (
        <>
          <div
            style={{
              fontSize: "12.5px",
              color: C.status.info.fg,
              background: C.status.info.bg,
              borderRadius: "4px",
              padding: "8px 10px",
            }}
          >
            {md.affect}
          </div>
        </>
      ) : null}
    </>
  );
}
