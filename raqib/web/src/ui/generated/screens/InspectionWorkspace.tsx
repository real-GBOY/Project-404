/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import { Fragment } from "react";
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";
import { FONT } from "@/styles/typography";

export function InspectionWorkspace({ vm }: { vm: VM }) {
  const { arr, arrBack, hpad, ix, mobile, notMobile, pad, t } = vm;
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
        <div
          style={{
            position: "sticky",
            top: "0",
            zIndex: "5",
            background: C.surface.white,
            borderBottom: `1px solid ${C.border.hairline}`,
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", gap: "12px", padding: `10px ${hpad}` }}
          >
            <button
              onClick={ix.back}
              style={{
                height: "44px",
                minWidth: "44px",
                border: `1px solid ${C.border.input}`,
                background: C.surface.white,
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "16px",
              }}
            >
              {arrBack}
            </button>
            <div style={{ flex: "1", minWidth: "0", lineHeight: "1.3" }}>
              <div style={{ fontFamily: FONT.mono, fontSize: "11.5px", color: C.text.secondary }}>
                {ix.ref} · {ix.formTag}
              </div>
              <div
                style={{
                  fontWeight: "600",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {ix.title}
              </div>
            </div>
            {ix.showScore ? (
              <div style={{ textAlign: "end", lineHeight: "1.2" }}>
                <div style={{ fontSize: "11.5px", color: C.text.secondary }}>{t.currentScore}</div>
                <div style={{ fontWeight: "600", fontSize: "18px", color: ix.scoreC }}>
                  {ix.scoreTxt}
                </div>
              </div>
            ) : null}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: `0 ${hpad} 10px`,
            }}
          >
            <div
              style={{
                flex: "1",
                height: "4px",
                background: C.surface.track,
                borderRadius: "2px",
                overflow: "hidden",
              }}
            >
              <div style={{ height: "100%", width: ix.progW, background: C.brand.primary }}></div>
            </div>
            <span style={{ fontSize: "12px", color: C.text.secondary, whiteSpace: "nowrap" }}>
              {ix.progTxt}
            </span>
            <span style={{ fontSize: "12px", color: ix.saveC, whiteSpace: "nowrap" }}>
              {ix.saveTxt}
            </span>
          </div>
          {mobile ? (
            <>
              <div
                style={{ display: "flex", gap: "6px", overflowX: "auto", padding: "0 16px 10px" }}
              >
                {(ix.steps || []).map((st: any, __i: number) => (
                  <Fragment key={__i}>
                    <button
                      onClick={st.go}
                      style={{
                        flexShrink: "0",
                        height: "36px",
                        padding: "0 12px",
                        borderRadius: "18px",
                        border: `1px solid ${st.cbd}`,
                        background: st.cbg,
                        color: st.cfg,
                        fontSize: "12.5px",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {st.label}
                      <span style={{ opacity: ".75" }}>{st.meta}</span>
                    </button>
                  </Fragment>
                ))}
              </div>
            </>
          ) : null}
        </div>
        <div
          style={{
            flex: "1",
            display: "grid",
            gridTemplateColumns: ix.cols,
            gap: "24px",
            padding: pad,
            maxWidth: "1180px",
            width: "100%",
            margin: "0 auto",
            alignItems: "start",
          }}
        >
          {notMobile ? (
            <>
              <nav
                style={{
                  position: "sticky",
                  top: "110px",
                  background: C.surface.white,
                  border: `1px solid ${C.border.hairline}`,
                  borderRadius: "6px",
                  padding: "6px",
                }}
              >
                {(ix.steps || []).map((st: any, __i: number) => (
                  <Fragment key={__i}>
                    <button
                      onClick={st.go}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px",
                        border: "0",
                        borderRadius: "4px",
                        background: st.bg,
                        color: st.fg,
                        cursor: "pointer",
                        textAlign: "start",
                        fontSize: "13.5px",
                        minHeight: "44px",
                      }}
                    >
                      <span
                        style={{
                          width: "18px",
                          height: "18px",
                          borderRadius: "50%",
                          border: `1.5px solid ${st.mark}`,
                          color: st.mark,
                          fontSize: "11px",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: "0",
                          fontWeight: "700",
                        }}
                      >
                        {st.markTxt}
                      </span>
                      <span style={{ flex: "1" }}>{st.label}</span>
                      <span
                        style={{
                          fontSize: "12px",
                          color: C.text.muted,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {st.meta}
                      </span>
                    </button>
                  </Fragment>
                ))}
              </nav>
            </>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: "0" }}>
            {ix.isReturned ? (
              <>
                <div
                  style={{
                    background: C.status.warning.bg,
                    border: `1px solid ${C.status.warning.border}`,
                    borderRadius: "6px",
                    padding: "12px 14px",
                    fontSize: "13.5px",
                    color: C.status.warning.deep,
                  }}
                >
                  <div style={{ fontWeight: "600", color: C.status.warning.strong }}>
                    {t.returnedBy} {ix.retBy} · {ix.retCount}
                  </div>
                  {ix.retReason}
                </div>
              </>
            ) : null}
            <div>
              <h2 style={{ margin: "0", fontSize: "18px", fontWeight: "600" }}>{ix.secTitle}</h2>
              <div style={{ fontSize: "12.5px", color: C.text.secondary }}>{ix.secSub}</div>
            </div>
            {ix.isSection ? (
              <>
                {(ix.questions || []).map((q: any, __i: number) => (
                  <Fragment key={__i}>
                    <div
                      style={{
                        background: C.surface.white,
                        border: `1px solid ${q.border}`,
                        borderRadius: "6px",
                        padding: "16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                      }}
                    >
                      {q.flagged ? (
                        <>
                          <div
                            style={{
                              background: C.status.warning.bg,
                              borderRadius: "4px",
                              padding: "10px 12px",
                              fontSize: "13px",
                              color: C.status.warning.strong,
                              display: "flex",
                              gap: "10px",
                              alignItems: "flex-start",
                            }}
                          >
                            <div style={{ flex: "1" }}>
                              <div style={{ fontWeight: "600" }}>{t.reviewerRequest}</div>
                              <div>{q.flagMsg}</div>
                            </div>
                            <span
                              style={{
                                fontSize: "12px",
                                fontWeight: "600",
                                color: q.fixC,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {q.fixTxt}
                            </span>
                          </div>
                        </>
                      ) : null}
                      <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                        <span
                          style={{
                            fontFamily: FONT.mono,
                            fontSize: "13px",
                            color: C.text.secondary,
                            paddingTop: "2px",
                          }}
                        >
                          {q.num}
                        </span>
                        <div
                          style={{
                            flex: "1",
                            fontSize: "15.5px",
                            fontWeight: "500",
                            lineHeight: "1.45",
                          }}
                        >
                          {q.text}
                        </div>
                        <span
                          style={{ fontSize: "12px", color: C.text.muted, whiteSpace: "nowrap" }}
                        >
                          {q.wTxt}
                        </span>
                      </div>
                      {q.locked ? (
                        <>
                          <div
                            style={{
                              fontSize: "12px",
                              color: C.text.secondary,
                              background: C.surface.subtle,
                              borderRadius: "3px",
                              padding: "6px 10px",
                            }}
                          >
                            {q.lockTxt}
                          </div>
                        </>
                      ) : null}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(3,minmax(0,1fr))",
                          gap: "8px",
                        }}
                      >
                        {(q.opts || []).map((o: any, __i: number) => (
                          <Fragment key={__i}>
                            <button
                              onClick={o.set}
                              style={{
                                height: "50px",
                                borderRadius: "4px",
                                border: `1.5px solid ${o.bd}`,
                                background: o.bg,
                                color: o.fg,
                                fontSize: "14px",
                                fontWeight: "500",
                                cursor: "pointer",
                                padding: "0 6px",
                              }}
                            >
                              {o.label}
                            </button>
                          </Fragment>
                        ))}
                      </div>
                      {q.showDetail ? (
                        <>
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <label style={{ fontSize: "13px", fontWeight: "500" }}>
                              {q.noteLabel}
                            </label>
                            <textarea
                              value={q.note}
                              onChange={q.onNote}
                              readOnly={q.locked}
                              rows={2}
                              placeholder={t.notePh}
                              style={{
                                width: "100%",
                                border: `1px solid ${q.noteBd}`,
                                borderRadius: "4px",
                                padding: "10px 12px",
                                fontSize: "14px",
                                resize: "vertical",
                                background: C.surface.white,
                                lineHeight: "1.5",
                              }}
                            ></textarea>
                            {q.noteErr ? (
                              <>
                                <span style={{ fontSize: "12px", color: C.status.danger.fg }}>
                                  {t.noteRequired}
                                </span>
                              </>
                            ) : null}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "8px",
                              }}
                            >
                              <span style={{ fontSize: "13px", fontWeight: "500" }}>
                                {q.evLabel}
                              </span>
                              {q.evErr ? (
                                <>
                                  <span style={{ fontSize: "12px", color: C.status.danger.fg }}>
                                    {t.evRequired}
                                  </span>
                                </>
                              ) : null}
                            </div>
                            {q.hasEv ? (
                              <>
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))",
                                    gap: "8px",
                                  }}
                                >
                                  {(q.ev || []).map((e: any, __i: number) => (
                                    <Fragment key={__i}>
                                      <div
                                        style={{
                                          border: `1px solid ${C.border.hairline}`,
                                          borderRadius: "4px",
                                          overflow: "hidden",
                                          background: C.surface.white,
                                        }}
                                      >
                                        <div
                                          onClick={e.open}
                                          style={{
                                            height: "84px",
                                            position: "relative",
                                            cursor: "pointer",
                                            background: `repeating-linear-gradient(135deg,${C.surface.sunkenAlt} 0 8px,${C.surface.sunkenDeep} 8px 16px)`,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                          }}
                                          role="button"
                                          tabIndex={0}
                                          onKeyDown={(e: any) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                              e.preventDefault();
                                              e.open(e);
                                            }
                                          }}
                                        >
                                          {e.hasUrl ? (
                                            <>
                                              <div
                                                style={{
                                                  position: "absolute",
                                                  inset: "0",
                                                  backgroundPosition: "center",
                                                  backgroundSize: "cover",
                                                  backgroundRepeat: "no-repeat",
                                                  backgroundImage: e.bgImg,
                                                }}
                                              ></div>
                                            </>
                                          ) : null}
                                          <span
                                            style={{
                                              position: "relative",
                                              fontFamily: FONT.mono,
                                              fontSize: "10.5px",
                                              color: C.text.body,
                                              background: C.glass,
                                              padding: "2px 6px",
                                              borderRadius: "2px",
                                            }}
                                          >
                                            {e.kindLabel}
                                          </span>
                                        </div>
                                        <div
                                          style={{
                                            padding: "7px 9px",
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "3px",
                                          }}
                                        >
                                          <div
                                            dir="ltr"
                                            style={{
                                              fontSize: "12px",
                                              whiteSpace: "nowrap",
                                              overflow: "hidden",
                                              textOverflow: "ellipsis",
                                              textAlign: "start",
                                            }}
                                          >
                                            {e.name}
                                          </div>
                                          <div style={{ fontSize: "11px", color: e.stC }}>
                                            {e.meta}
                                          </div>
                                          {e.busy ? (
                                            <>
                                              <div
                                                style={{
                                                  height: "3px",
                                                  background: C.surface.track,
                                                  borderRadius: "2px",
                                                  overflow: "hidden",
                                                }}
                                              >
                                                <div
                                                  style={{
                                                    height: "100%",
                                                    width: e.pW,
                                                    background: C.status.info.fg,
                                                  }}
                                                ></div>
                                              </div>
                                            </>
                                          ) : null}
                                          <div style={{ display: "flex", gap: "12px" }}>
                                            {e.failed ? (
                                              <>
                                                <button
                                                  onClick={e.retry}
                                                  style={{
                                                    background: "none",
                                                    border: "0",
                                                    padding: "4px 0",
                                                    color: C.brand.primary,
                                                    fontSize: "12px",
                                                    cursor: "pointer",
                                                  }}
                                                >
                                                  {t.retry}
                                                </button>
                                              </>
                                            ) : null}
                                            {e.canRemove ? (
                                              <>
                                                <button
                                                  onClick={e.remove}
                                                  style={{
                                                    background: "none",
                                                    border: "0",
                                                    padding: "4px 0",
                                                    color: C.status.danger.fg,
                                                    fontSize: "12px",
                                                    cursor: "pointer",
                                                  }}
                                                >
                                                  {t.remove}
                                                </button>
                                              </>
                                            ) : null}
                                          </div>
                                        </div>
                                      </div>
                                    </Fragment>
                                  ))}
                                </div>
                              </>
                            ) : null}
                            {q.canEdit ? (
                              <>
                                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                  <button
                                    onClick={q.capture}
                                    style={{
                                      height: "44px",
                                      padding: "0 16px",
                                      border: `1px solid ${C.brand.primary}`,
                                      borderRadius: "4px",
                                      background: C.surface.white,
                                      color: C.brand.primary,
                                      fontWeight: "500",
                                      cursor: "pointer",
                                    }}
                                  >
                                    {t.capturePhoto}
                                  </button>
                                  <button
                                    onClick={q.video}
                                    style={{
                                      height: "44px",
                                      padding: "0 16px",
                                      border: `1px solid ${C.border.input}`,
                                      borderRadius: "4px",
                                      background: C.surface.white,
                                      cursor: "pointer",
                                    }}
                                  >
                                    {t.recordVideo}
                                  </button>
                                  <button
                                    onClick={q.upload}
                                    style={{
                                      height: "44px",
                                      padding: "0 16px",
                                      border: `1px solid ${C.border.input}`,
                                      borderRadius: "4px",
                                      background: C.surface.white,
                                      cursor: "pointer",
                                    }}
                                  >
                                    {t.uploadFile}
                                  </button>
                                </div>
                              </>
                            ) : null}
                            <div style={{ fontSize: "11.5px", color: C.text.muted }}>
                              {t.attachPolicyHint}
                            </div>
                          </div>
                          {q.isNC ? (
                            <>
                              <div
                                style={{
                                  borderTop: `1px solid ${C.surface.track}`,
                                  paddingTop: "10px",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "8px",
                                }}
                              >
                                <label
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "10px",
                                    minHeight: "40px",
                                    fontSize: "14px",
                                    cursor: "pointer",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={q.obsOn}
                                    onChange={q.toggleObs}
                                    style={{
                                      width: "20px",
                                      height: "20px",
                                      accentColor: C.brand.primary,
                                    }}
                                  />
                                  {t.logObservation}
                                </label>
                                {q.obsOn ? (
                                  <>
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "10px",
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      <span style={{ fontSize: "13px", color: C.text.secondary }}>
                                        {t.severity}
                                      </span>
                                      <div
                                        style={{
                                          display: "flex",
                                          border: `1px solid ${C.border.input}`,
                                          borderRadius: "4px",
                                          overflow: "hidden",
                                        }}
                                      >
                                        {(q.sevOpts || []).map((o: any, __i: number) => (
                                          <Fragment key={__i}>
                                            <button
                                              onClick={o.set}
                                              style={{
                                                border: "0",
                                                height: "40px",
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
                                    </div>
                                  </>
                                ) : null}
                              </div>
                            </>
                          ) : null}
                        </>
                      ) : null}
                      {q.showAdd ? (
                        <>
                          <button
                            onClick={q.expand}
                            style={{
                              alignSelf: "flex-start",
                              background: "none",
                              border: "0",
                              color: C.brand.primary,
                              fontSize: "13px",
                              cursor: "pointer",
                              padding: "4px 0",
                              minHeight: "32px",
                            }}
                          >
                            {t.addNoteEvidence}
                          </button>
                        </>
                      ) : null}
                    </div>
                  </Fragment>
                ))}
              </>
            ) : null}
            {ix.isGuards ? (
              <>
                {(ix.guards || []).map((g: any, __i: number) => (
                  <Fragment key={__i}>
                    <div
                      style={{
                        background: C.surface.white,
                        border: `1px solid ${C.border.hairline}`,
                        borderRadius: "6px",
                        padding: "16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "12px",
                          alignItems: "flex-start",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: "600", fontSize: "15.5px" }}>{g.name}</div>
                          <div style={{ fontSize: "12px", color: C.text.secondary }}>
                            <span style={{ fontFamily: FONT.mono }}>{g.emp}</span>· {g.post} ·{" "}
                            {g.shift} · {g.proj}
                          </div>
                        </div>
                        <div style={{ textAlign: "end" }}>
                          <div style={{ fontWeight: "600", fontSize: "18px", color: g.scoreC }}>
                            {g.scoreTxt}
                          </div>
                          <div style={{ fontSize: "12px", color: C.text.secondary }}>
                            {g.result}
                          </div>
                        </div>
                      </div>
                      {g.hasFlag ? (
                        <>
                          <div
                            style={{
                              fontSize: "12.5px",
                              color: C.status.warning.strong,
                              background: C.status.warning.bg,
                              padding: "6px 10px",
                              borderRadius: "3px",
                            }}
                          >
                            {t.history}: {g.flag}
                          </div>
                        </>
                      ) : null}
                      {(g.crit || []).map((c: any, __i: number) => (
                        <Fragment key={__i}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px 12px",
                              flexWrap: "wrap",
                              padding: "8px 0",
                              borderTop: `1px solid ${C.surface.track}`,
                            }}
                          >
                            <span style={{ flex: "1", minWidth: "150px", fontSize: "14px" }}>
                              {c.label}
                            </span>
                            <div style={{ display: "flex", gap: "6px" }}>
                              {(c.opts || []).map((o: any, __i: number) => (
                                <Fragment key={__i}>
                                  <button
                                    onClick={o.set}
                                    style={{
                                      width: "44px",
                                      height: "44px",
                                      borderRadius: "4px",
                                      border: `1px solid ${o.bd}`,
                                      background: o.bg,
                                      color: o.fg,
                                      fontWeight: "500",
                                      cursor: "pointer",
                                      fontSize: "15px",
                                    }}
                                  >
                                    {o.n}
                                  </button>
                                </Fragment>
                              ))}
                            </div>
                          </div>
                        </Fragment>
                      ))}
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                          borderTop: `1px solid ${C.surface.track}`,
                          paddingTop: "8px",
                        }}
                      >
                        <span style={{ fontSize: "13px", fontWeight: "500" }}>{t.evOpt}</span>
                        {g.hasEv ? (
                          <>
                            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                              {(g.ev || []).map((e: any, __i: number) => (
                                <Fragment key={__i}>
                                  <div
                                    onClick={e.open}
                                    title={e.name}
                                    style={{
                                      width: "72px",
                                      height: "54px",
                                      border: `1px solid ${C.border.hairline}`,
                                      borderRadius: "3px",
                                      position: "relative",
                                      overflow: "hidden",
                                      cursor: "pointer",
                                      background: `repeating-linear-gradient(135deg,${C.surface.sunkenAlt} 0 6px,${C.surface.sunkenDeep} 6px 12px)`,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e: any) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        e.open(e);
                                      }
                                    }}
                                  >
                                    {e.hasUrl ? (
                                      <>
                                        <div
                                          style={{
                                            position: "absolute",
                                            inset: "0",
                                            backgroundSize: "cover",
                                            backgroundPosition: "center",
                                            backgroundImage: e.bgImg,
                                          }}
                                        ></div>
                                      </>
                                    ) : null}
                                    <span
                                      style={{
                                        position: "relative",
                                        fontSize: "9.5px",
                                        background: C.glass,
                                        padding: "0 3px",
                                        color: e.stC,
                                      }}
                                    >
                                      {e.meta}
                                    </span>
                                  </div>
                                </Fragment>
                              ))}
                            </div>
                          </>
                        ) : null}
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            onClick={g.capture}
                            style={{
                              height: "40px",
                              padding: "0 14px",
                              border: `1px solid ${C.brand.primary}`,
                              borderRadius: "4px",
                              background: C.surface.white,
                              color: C.brand.primary,
                              cursor: "pointer",
                            }}
                          >
                            {t.capturePhoto}
                          </button>
                          <button
                            onClick={g.upload}
                            style={{
                              height: "40px",
                              padding: "0 14px",
                              border: `1px solid ${C.border.input}`,
                              borderRadius: "4px",
                              background: C.surface.white,
                              cursor: "pointer",
                            }}
                          >
                            {t.uploadFile}
                          </button>
                        </div>
                      </div>
                      <textarea
                        value={g.note}
                        onChange={g.onNote}
                        rows={2}
                        placeholder={t.guardNotePh}
                        style={{
                          width: "100%",
                          border: `1px solid ${C.border.input}`,
                          borderRadius: "4px",
                          padding: "10px 12px",
                          fontSize: "14px",
                          resize: "vertical",
                        }}
                      ></textarea>
                    </div>
                  </Fragment>
                ))}
                {ix.noGuards ? (
                  <>
                    <div
                      style={{
                        background: C.surface.white,
                        border: `1px dashed ${C.border.input}`,
                        borderRadius: "6px",
                        padding: "24px",
                        textAlign: "center",
                        color: C.text.secondary,
                      }}
                    >
                      {t.noGuardsAssigned}
                    </div>
                  </>
                ) : null}
              </>
            ) : null}
            {ix.isSubmit ? (
              <>
                <section
                  style={{
                    background: C.surface.white,
                    border: `1px solid ${C.border.hairline}`,
                    borderRadius: "6px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))",
                    }}
                  >
                    {(ix.stats || []).map((x: any, __i: number) => (
                      <Fragment key={__i}>
                        <div
                          style={{
                            padding: "14px 16px",
                            borderInlineEnd: `1px solid ${C.surface.track}`,
                            borderBottom: `1px solid ${C.surface.track}`,
                          }}
                        >
                          <div style={{ fontSize: "12px", color: C.text.secondary }}>{x.k}</div>
                          <div style={{ fontSize: "22px", fontWeight: "600" }}>{x.v}</div>
                        </div>
                      </Fragment>
                    ))}
                  </div>
                  <div
                    style={{
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    {ix.hasIssues ? (
                      <>
                        <div style={{ fontWeight: "600", color: C.status.danger.fg }}>
                          {t.beforeSubmit}
                        </div>
                        {(ix.issues || []).map((x: any, __i: number) => (
                          <Fragment key={__i}>
                            <div
                              style={{
                                display: "flex",
                                gap: "12px",
                                alignItems: "center",
                                padding: "8px 12px",
                                background: C.status.danger.bgFaint,
                                border: `1px solid ${C.status.danger.bgRose}`,
                                borderRadius: "4px",
                                fontSize: "13.5px",
                              }}
                            >
                              <span style={{ flex: "1" }}>{x.txt}</span>
                              <button
                                onClick={x.go}
                                style={{
                                  background: "none",
                                  border: "0",
                                  color: C.brand.primary,
                                  cursor: "pointer",
                                  fontSize: "13px",
                                  minHeight: "36px",
                                }}
                              >
                                {t.goToItem}
                              </button>
                            </div>
                          </Fragment>
                        ))}
                      </>
                    ) : null}
                    {ix.noIssues ? (
                      <>
                        <div
                          style={{
                            padding: "10px 12px",
                            background: C.status.success.bg,
                            color: C.status.success.fg,
                            borderRadius: "4px",
                            fontSize: "13.5px",
                            fontWeight: "500",
                          }}
                        >
                          {t.allComplete}
                        </div>
                      </>
                    ) : null}
                    <label
                      style={{
                        display: "flex",
                        gap: "10px",
                        alignItems: "flex-start",
                        fontSize: "13.5px",
                        cursor: "pointer",
                        padding: "6px 0",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={ix.decl}
                        onChange={ix.onDecl}
                        style={{
                          width: "20px",
                          height: "20px",
                          accentColor: C.brand.primary,
                          marginTop: "1px",
                          flexShrink: "0",
                        }}
                      />
                      {t.inspectorDecl}
                    </label>
                    <button
                      onClick={ix.submit}
                      disabled={ix.submitDisabled}
                      style={{
                        height: "50px",
                        border: "0",
                        borderRadius: "4px",
                        background: ix.submitBg,
                        color: C.surface.white,
                        fontSize: "15px",
                        fontWeight: "500",
                        cursor: "pointer",
                      }}
                    >
                      {ix.submitLabel}
                    </button>
                  </div>
                </section>
              </>
            ) : null}
            {notMobile ? (
              <>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    justifyContent: "space-between",
                    paddingTop: "8px",
                  }}
                >
                  <div>
                    {ix.hasPrev ? (
                      <>
                        <button
                          onClick={ix.prev}
                          style={{
                            height: "44px",
                            padding: "0 16px",
                            border: `1px solid ${C.border.input}`,
                            borderRadius: "4px",
                            background: C.surface.white,
                            cursor: "pointer",
                          }}
                        >
                          {arrBack} {t.prevSection}
                        </button>
                      </>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={ix.saveDraft}
                      style={{
                        height: "44px",
                        padding: "0 16px",
                        border: `1px solid ${C.border.input}`,
                        borderRadius: "4px",
                        background: C.surface.white,
                        cursor: "pointer",
                      }}
                    >
                      {t.saveExit}
                    </button>
                    {ix.hasNext ? (
                      <>
                        <button
                          onClick={ix.next}
                          style={{
                            height: "44px",
                            padding: "0 18px",
                            border: "0",
                            borderRadius: "4px",
                            background: C.text.ink,
                            color: C.surface.white,
                            cursor: "pointer",
                          }}
                        >
                          {ix.nextLabel} {arr}
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
        {mobile ? (
          <>
            <div
              style={{
                position: "sticky",
                bottom: "0",
                background: C.surface.white,
                borderTop: `1px solid ${C.border.hairline}`,
                padding: "10px 12px",
                display: "flex",
                gap: "8px",
                zIndex: "5",
              }}
            >
              <button
                onClick={ix.prev}
                style={{
                  height: "48px",
                  minWidth: "48px",
                  border: `1px solid ${C.border.input}`,
                  borderRadius: "4px",
                  background: C.surface.white,
                  cursor: "pointer",
                  fontSize: "16px",
                }}
              >
                {arrBack}
              </button>
              <button
                onClick={ix.saveDraft}
                style={{
                  height: "48px",
                  flex: "1",
                  border: `1px solid ${C.border.input}`,
                  borderRadius: "4px",
                  background: C.surface.white,
                  cursor: "pointer",
                }}
              >
                {t.saveExit}
              </button>
              {ix.hasNext ? (
                <>
                  <button
                    onClick={ix.next}
                    style={{
                      height: "48px",
                      flex: "1.4",
                      border: "0",
                      borderRadius: "4px",
                      background: C.text.ink,
                      color: C.surface.white,
                      cursor: "pointer",
                      fontWeight: "500",
                    }}
                  >
                    {ix.nextLabel}
                  </button>
                </>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
