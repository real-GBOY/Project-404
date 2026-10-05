/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import { Fragment } from "react";
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";
import { FONT } from "@/styles/typography";

export function ReviewDetail({ vm }: { vm: VM }) {
  const { arrBack, mainCols, pad, rv, t } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "1360px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
<button onClick={rv.back} style={{ alignSelf: "flex-start", background: "none", border: "0", padding: "0", color: C.brand.primary, fontSize: "13px", cursor: "pointer" }}>
{arrBack} {t.back}
</button>
<div>
<div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
<span style={{ fontFamily: FONT.mono, fontSize: "12.5px", color: C.text.secondary }}>
{rv.ref}
</span>
<span style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", fontWeight: "500", color: rv.st.fg, background: rv.st.bg }}>
<span style={{ width: "6px", height: "6px", borderRadius: "50%", background: rv.st.fg }}></span>
{rv.st.label}
</span>
</div>
<h1 style={{ margin: "2px 0 2px", fontSize: "22px", fontWeight: "600" }}>
{rv.title}
</h1>
<div style={{ fontSize: "13px", color: C.text.secondary }}>
{rv.proj} · {rv.submitted}
</div>
<div style={{ display: "inline-flex", gap: "8px", alignItems: "center", fontSize: "12px", color: C.text.body, background: C.surface.sunken, borderRadius: "3px", padding: "4px 8px", marginTop: "8px", flexWrap: "wrap" }}>
<span style={{ fontFamily: FONT.mono }}>
{rv.formTag}
</span>
<span>
{t.versionLocked}
</span>
{rv.canVer ? (<>
<button onClick={rv.verGo} style={{ background: "none", border: "0", padding: "0", color: C.brand.primary, fontSize: "12px", cursor: "pointer" }}>
{t.viewVersion}
</button>
</>) : null}
</div>
</div>
<div style={{ display: "grid", gridTemplateColumns: mainCols, gap: "20px", alignItems: "start" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: "0" }}>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", overflow: "hidden" }}>
{(rv.stats || []).map((x: any, __i: number) => (<Fragment key={__i}>
<div style={{ padding: "14px 16px", borderInlineEnd: `1px solid ${C.surface.track}` }}>
<div style={{ fontSize: "12px", color: C.text.secondary }}>
{x.k}
</div>
<div style={{ fontSize: "22px", fontWeight: "600" }}>
{x.v}
</div>
</div>
</Fragment>))}
</section>
{(rv.sections || []).map((sec: any, __i: number) => (<Fragment key={__i}>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px", overflow: "hidden" }}>
<div style={{ padding: "12px 18px", display: "flex", justifyContent: "space-between", gap: "12px", background: C.surface.paper, borderBottom: `1px solid ${C.surface.track}` }}>
<h2 style={{ margin: "0", fontSize: "14.5px", fontWeight: "600" }}>
{sec.title}
</h2>
<span style={{ fontWeight: "600", color: sec.scoreC }}>
{sec.scoreTxt}
</span>
</div>
{(sec.items || []).map((it: any, __i: number) => (<Fragment key={__i}>
<div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.surface.track}`, display: "flex", flexDirection: "column", gap: "8px", background: it.bg }}>
<div style={{ display: "flex", gap: "10px 12px", alignItems: "flex-start", flexWrap: "wrap" }}>
<span style={{ fontFamily: FONT.mono, fontSize: "12.5px", color: C.text.secondary, paddingTop: "2px" }}>
{it.num}
</span>
<span style={{ flex: "1", minWidth: "200px", fontSize: "14px" }}>
{it.text}
</span>
<span style={{ fontSize: "12px", color: C.text.muted, whiteSpace: "nowrap" }}>
{it.w} · {it.pts}
</span>
<span style={{ height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", fontWeight: "500", color: it.ans.fg, background: it.ans.bg, display: "inline-flex", alignItems: "center", whiteSpace: "nowrap" }}>
{it.ans.label}
</span>
</div>
{it.hasNote ? (<>
<div style={{ fontSize: "13px", color: C.text.body, paddingInlineStart: "34px" }}>
{it.note}
</div>
</>) : null}
{it.hasEv ? (<>
<div style={{ display: "flex", gap: "6px", paddingInlineStart: "34px", flexWrap: "wrap" }}>
{(it.ev || []).map((e: any, __i: number) => (<Fragment key={__i}>
<div title={e.name} onClick={e.open} style={{ cursor: "pointer", width: "64px", height: "48px", border: `1px solid ${C.border.hairline}`, borderRadius: "3px", position: "relative", overflow: "hidden", background: `repeating-linear-gradient(135deg,${C.surface.sunkenAlt} 0 6px,${C.surface.sunkenDeep} 6px 12px)`, display: "flex", alignItems: "center", justifyContent: "center" }} role="button" tabIndex={0} onKeyDown={(e: any) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (e.open)(e); } }}>
{e.hasUrl ? (<>
<div style={{ position: "absolute", inset: "0", backgroundPosition: "center", backgroundSize: "cover", backgroundRepeat: "no-repeat", backgroundImage: e.bgImg }}></div>
</>) : null}
<span style={{ position: "relative", fontFamily: FONT.mono, fontSize: "9px", color: C.text.body, background: C.glass, padding: "0 3px" }}>
{e.kindLabel}
</span>
</div>
</Fragment>))}
</div>
</>) : null}
<div style={{ display: "flex", gap: "8px 16px", alignItems: "center", flexWrap: "wrap", paddingInlineStart: "34px" }}>
{it.canFlag ? (<>
<label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", color: C.status.warning.strong, cursor: "pointer", minHeight: "32px" }}>
<input type="checkbox" checked={it.flag} onChange={it.onFlag} style={{ width: "18px", height: "18px", accentColor: C.status.warning.fg }} />
{t.flagForReturn}
</label>
</>) : null}
{it.canCA ? (<>
<button onClick={it.mkCA} style={{ height: "32px", padding: "0 12px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, fontSize: "12.5px", cursor: "pointer" }}>
{t.createCA}
</button>
</>) : null}
{it.hasCA ? (<>
<button onClick={it.goCA} style={{ background: "none", border: "0", padding: "0", fontSize: "12.5px", color: C.brand.primary, cursor: "pointer" }}>
<span style={{ fontFamily: FONT.mono }}>
{it.caRef}
</span>
 · {it.caSt}
</button>
</>) : null}
</div>
</div>
</Fragment>))}
</section>
</Fragment>))}
{rv.hasGuards ? (<>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "14.5px", fontWeight: "600", padding: "12px 18px", background: C.surface.paper, borderBottom: `1px solid ${C.surface.track}` }}>
{t.guardEval}
</h2>
{(rv.guards || []).map((g: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "flex", gap: "12px", alignItems: "flex-start", padding: "12px 18px", borderBottom: `1px solid ${C.surface.subtle}`, flexWrap: "wrap" }}>
<span style={{ flex: "1", minWidth: "200px" }}>
<span style={{ display: "block", fontWeight: "500" }}>
{g.name} 
<span style={{ fontFamily: FONT.mono, fontSize: "12px", color: C.text.muted }}>
{g.emp}
</span>
</span>
<span style={{ display: "block", fontSize: "12.5px", color: C.text.secondary }}>
{g.note}
</span>
</span>
<span style={{ fontSize: "12.5px", color: C.text.secondary }}>
{g.result}
</span>
<span style={{ fontWeight: "600", color: g.scoreC }}>
{g.score}
</span>
</div>
</Fragment>))}
</section>
</>) : null}
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "16px", position: "sticky", top: "16px" }}>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px", padding: "18px", display: "flex", flexDirection: "column", gap: "12px" }}>
<div style={{ fontWeight: "600", fontSize: "15px" }}>
{t.decision}
</div>
<div style={{ display: "flex", gap: "4px" }}>
{(rv.stages || []).map((sg: any, __i: number) => (<Fragment key={__i}>
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ height: "4px", borderRadius: "2px", background: sg.c }}></div>
<div style={{ fontSize: "11.5px", marginTop: "4px", color: sg.fg, fontWeight: sg.fw }}>
{sg.l}
</div>
<div style={{ fontSize: "10.5px", color: C.text.muted }}>
{sg.sub}
</div>
</div>
</Fragment>))}
</div>
{rv.hasStageNote ? (<>
<div style={{ fontSize: "12.5px", color: C.status.review.deep, background: C.status.review.bg, borderRadius: "4px", padding: "8px 10px" }}>
{rv.stageNote}
</div>
</>) : null}
<div style={{ fontSize: "12px", color: C.text.secondary, display: "flex", justifyContent: "space-between", gap: "8px" }}>
<span>
{rv.round}
</span>
<span>
{rv.immutable}
</span>
</div>
{rv.isResub ? (<>
<div style={{ fontSize: "12.5px", border: `1px solid ${C.status.warning.border}`, background: C.status.warning.bgFaint, borderRadius: "4px", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "6px" }}>
<div style={{ fontWeight: "600", color: C.status.warning.strong }}>
{t.prevReturn}
</div>
<div>
{rv.prevReason}
</div>
{(rv.prev || []).map((p: any, __i: number) => (<Fragment key={__i}>
<div style={{ borderTop: `1px solid ${C.status.warning.bgDeep}`, paddingTop: "6px" }}>
<div>
<span style={{ fontFamily: FONT.mono, color: C.status.warning.fg }}>
{p.num}
</span>
 {p.text}
</div>
<div style={{ color: C.text.secondary }}>
{t.nowAnswer}: 
<b style={{ color: C.text.ink }}>
{p.now}
</b>
 · {p.note}
</div>
</div>
</Fragment>))}
</div>
</>) : null}
{rv.isRejected ? (<>
<div style={{ fontSize: "13px", background: C.status.danger.bg, color: C.status.danger.deep, borderRadius: "4px", padding: "10px 12px" }}>
<div style={{ fontWeight: "600" }}>
{t.rejectedReason}
</div>
{rv.rejReason}
<div style={{ fontSize: "12px", marginTop: "6px" }}>
{rv.decMeta}
</div>
</div>
</>) : null}
{rv.hasReviewedNote ? (<>
<div style={{ fontSize: "13px", background: C.status.review.bg, color: C.status.review.deep, borderRadius: "4px", padding: "10px 12px" }}>
<div style={{ fontWeight: "600" }}>
{rv.reviewedBy}
</div>
{rv.reviewedNote}
</div>
</>) : null}
{rv.canDecide ? (<>
<div style={{ fontSize: "13px", color: C.text.secondary }}>
{rv.hint}
</div>
{rv.hasFlags ? (<>
<div style={{ fontSize: "13px", color: C.status.warning.strong, fontWeight: "500" }}>
{rv.flagTxt}
</div>
</>) : null}
<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
{rv.canApprove ? (<>
<button onClick={rv.approve} style={{ height: "44px", border: "0", borderRadius: "4px", background: C.brand.primary, color: C.surface.white, fontWeight: "500", cursor: "pointer" }}>
{t.approveInsp}
</button>
</>) : null}
{rv.canForward ? (<>
<button onClick={rv.forward} style={{ height: "44px", border: "0", borderRadius: "4px", background: C.brand.primary, color: C.surface.white, fontWeight: "500", cursor: "pointer" }}>
{t.forwardApproval}
</button>
</>) : null}
<button onClick={rv.ret} style={{ height: "44px", border: `1px solid ${C.status.warning.borderStrong}`, borderRadius: "4px", background: C.surface.white, color: C.status.warning.fg, fontWeight: "500", cursor: "pointer" }}>
{t.returnCompletion}
</button>
<button onClick={rv.reject} style={{ height: "44px", border: `1px solid ${C.status.danger.border}`, borderRadius: "4px", background: C.surface.white, color: C.status.danger.fg, fontWeight: "500", cursor: "pointer" }}>
{t.rejectInsp}
</button>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", color: C.text.secondary, borderTop: `1px solid ${C.surface.track}`, paddingTop: "8px" }}>
<div>
<b style={{ color: C.status.warning.fg }}>
{t.returnCompletion}
</b>
 — {rv.retExplain}
</div>
<div>
<b style={{ color: C.status.danger.fg }}>
{t.rejectInsp}
</b>
 — {rv.rejExplain}
</div>
{rv.canForward ? (<>
<div>
<b style={{ color: C.brand.primary }}>
{t.forwardApproval}
</b>
 — {rv.fwdExplain}
</div>
</>) : null}
{rv.canApprove ? (<>
<div>
<b style={{ color: C.brand.primary }}>
{t.approveInsp}
</b>
 — {rv.appExplain}
</div>
</>) : null}
</div>
{rv.noApproveNote ? (<>
<div style={{ fontSize: "12px", color: C.text.muted }}>
{t.noApproveAuthority}
</div>
</>) : null}
</>) : null}
{rv.readOnly ? (<>
<div style={{ fontSize: "13px", color: C.text.body }}>
{rv.roMsg}
</div>
{rv.hasReport ? (<>
<button onClick={rv.report} style={{ height: "44px", border: "0", borderRadius: "4px", background: C.brand.primary, color: C.surface.white, fontWeight: "500", cursor: "pointer" }}>
{t.viewReport}
</button>
</>) : null}
</>) : null}
</section>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px", padding: "16px 18px" }}>
<h2 style={{ margin: "0 0 14px", fontSize: "15px", fontWeight: "600" }}>
{t.workflowHistory}
</h2>
{(rv.timeline || []).map((h: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "grid", gridTemplateColumns: "14px 1fr", gap: "10px" }}>
<div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
<span style={{ width: "10px", height: "10px", borderRadius: "50%", background: h.c, marginTop: "5px", flexShrink: "0" }}></span>
<span style={{ flex: "1", width: "1px", background: C.border.hairline, marginTop: "4px" }}></span>
</div>
<div style={{ paddingBottom: "14px", minWidth: "0" }}>
<div style={{ fontWeight: "500", fontSize: "13.5px" }}>
{h.label}
</div>
<div style={{ fontSize: "12px", color: C.text.secondary }}>
{h.actor} · {h.role} · {h.at}
</div>
{h.hasReason ? (<>
<div style={{ marginTop: "6px", fontSize: "13px", background: C.surface.paper, border: `1px solid ${C.surface.track}`, borderRadius: "4px", padding: "8px 10px" }}>
{h.reason}
</div>
</>) : null}
</div>
</div>
</Fragment>))}
</section>
</div>
</div>
</div>
</>);
}
