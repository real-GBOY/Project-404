/* eslint-disable */
// GENERATED from the approved Claude Design (Raqib.dc.html) by tools/transpile — do not hand-edit.
import { Fragment } from "react";
import type { VM } from "@/ui/vm";

export function ReviewDetail({ vm }: { vm: VM }) {
  const { arrBack, mainCols, pad, rv, t } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "1360px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
<button onClick={rv.back} style={{ alignSelf: "flex-start", background: "none", border: "0", padding: "0", color: "#0F5C4A", fontSize: "13px", cursor: "pointer" }}>
{arrBack} {t.back}
</button>
<div>
<div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
<span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "12.5px", color: "#5C6168" }}>
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
<div style={{ fontSize: "13px", color: "#5C6168" }}>
{rv.proj} · {rv.submitted}
</div>
<div style={{ display: "inline-flex", gap: "8px", alignItems: "center", fontSize: "12px", color: "#3D4247", background: "#ECEAE5", borderRadius: "3px", padding: "4px 8px", marginTop: "8px", flexWrap: "wrap" }}>
<span style={{ fontFamily: "'IBM Plex Mono',monospace" }}>
{rv.formTag}
</span>
<span>
{t.versionLocked}
</span>
{rv.canVer ? (<>
<button onClick={rv.verGo} style={{ background: "none", border: "0", padding: "0", color: "#0F5C4A", fontSize: "12px", cursor: "pointer" }}>
{t.viewVersion}
</button>
</>) : null}
</div>
</div>
<div style={{ display: "grid", gridTemplateColumns: mainCols, gap: "20px", alignItems: "start" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: "0" }}>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", overflow: "hidden" }}>
{(rv.stats || []).map((x: any, __i: number) => (<Fragment key={__i}>
<div style={{ padding: "14px 16px", borderInlineEnd: "1px solid #EFEDE7" }}>
<div style={{ fontSize: "12px", color: "#5C6168" }}>
{x.k}
</div>
<div style={{ fontSize: "22px", fontWeight: "600" }}>
{x.v}
</div>
</div>
</Fragment>))}
</section>
{(rv.sections || []).map((sec: any, __i: number) => (<Fragment key={__i}>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px", overflow: "hidden" }}>
<div style={{ padding: "12px 18px", display: "flex", justifyContent: "space-between", gap: "12px", background: "#FAF9F6", borderBottom: "1px solid #EFEDE7" }}>
<h2 style={{ margin: "0", fontSize: "14.5px", fontWeight: "600" }}>
{sec.title}
</h2>
<span style={{ fontWeight: "600", color: sec.scoreC }}>
{sec.scoreTxt}
</span>
</div>
{(sec.items || []).map((it: any, __i: number) => (<Fragment key={__i}>
<div style={{ padding: "12px 18px", borderBottom: "1px solid #EFEDE7", display: "flex", flexDirection: "column", gap: "8px", background: it.bg }}>
<div style={{ display: "flex", gap: "10px 12px", alignItems: "flex-start", flexWrap: "wrap" }}>
<span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "12.5px", color: "#5C6168", paddingTop: "2px" }}>
{it.num}
</span>
<span style={{ flex: "1", minWidth: "200px", fontSize: "14px" }}>
{it.text}
</span>
<span style={{ fontSize: "12px", color: "#8B9097", whiteSpace: "nowrap" }}>
{it.w} · {it.pts}
</span>
<span style={{ height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", fontWeight: "500", color: it.ans.fg, background: it.ans.bg, display: "inline-flex", alignItems: "center", whiteSpace: "nowrap" }}>
{it.ans.label}
</span>
</div>
{it.hasNote ? (<>
<div style={{ fontSize: "13px", color: "#3D4247", paddingInlineStart: "34px" }}>
{it.note}
</div>
</>) : null}
{it.hasEv ? (<>
<div style={{ display: "flex", gap: "6px", paddingInlineStart: "34px", flexWrap: "wrap" }}>
{(it.ev || []).map((e: any, __i: number) => (<Fragment key={__i}>
<div title={e.name} onClick={e.open} style={{ cursor: "pointer", width: "64px", height: "48px", border: "1px solid #E3E1DA", borderRadius: "3px", position: "relative", overflow: "hidden", background: "repeating-linear-gradient(135deg,#F0EEE8 0 6px,#E8E5DE 6px 12px)", display: "flex", alignItems: "center", justifyContent: "center" }} role="button" tabIndex={0} onKeyDown={(e: any) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (e.open)(e); } }}>
{e.hasUrl ? (<>
<div style={{ position: "absolute", inset: "0", backgroundPosition: "center", backgroundSize: "cover", backgroundRepeat: "no-repeat", backgroundImage: e.bgImg }}></div>
</>) : null}
<span style={{ position: "relative", fontFamily: "'IBM Plex Mono',monospace", fontSize: "9px", color: "#3D4247", background: "rgba(255,255,255,.85)", padding: "0 3px" }}>
{e.kindLabel}
</span>
</div>
</Fragment>))}
</div>
</>) : null}
<div style={{ display: "flex", gap: "8px 16px", alignItems: "center", flexWrap: "wrap", paddingInlineStart: "34px" }}>
{it.canFlag ? (<>
<label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", color: "#6B4600", cursor: "pointer", minHeight: "32px" }}>
<input type="checkbox" checked={it.flag} onChange={it.onFlag} style={{ width: "18px", height: "18px", accentColor: "#8A5A00" }} />
{t.flagForReturn}
</label>
</>) : null}
{it.canCA ? (<>
<button onClick={it.mkCA} style={{ height: "32px", padding: "0 12px", border: "1px solid #D6D3CB", borderRadius: "4px", background: "#fff", fontSize: "12.5px", cursor: "pointer" }}>
{t.createCA}
</button>
</>) : null}
{it.hasCA ? (<>
<button onClick={it.goCA} style={{ background: "none", border: "0", padding: "0", fontSize: "12.5px", color: "#0F5C4A", cursor: "pointer" }}>
<span style={{ fontFamily: "'IBM Plex Mono',monospace" }}>
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
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "14.5px", fontWeight: "600", padding: "12px 18px", background: "#FAF9F6", borderBottom: "1px solid #EFEDE7" }}>
{t.guardEval}
</h2>
{(rv.guards || []).map((g: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "flex", gap: "12px", alignItems: "flex-start", padding: "12px 18px", borderBottom: "1px solid #F3F1EC", flexWrap: "wrap" }}>
<span style={{ flex: "1", minWidth: "200px" }}>
<span style={{ display: "block", fontWeight: "500" }}>
{g.name} 
<span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px", color: "#8B9097" }}>
{g.emp}
</span>
</span>
<span style={{ display: "block", fontSize: "12.5px", color: "#5C6168" }}>
{g.note}
</span>
</span>
<span style={{ fontSize: "12.5px", color: "#5C6168" }}>
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
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px", padding: "18px", display: "flex", flexDirection: "column", gap: "12px" }}>
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
<div style={{ fontSize: "10.5px", color: "#8B9097" }}>
{sg.sub}
</div>
</div>
</Fragment>))}
</div>
{rv.hasStageNote ? (<>
<div style={{ fontSize: "12.5px", color: "#3A2560", background: "#ECE6F5", borderRadius: "4px", padding: "8px 10px" }}>
{rv.stageNote}
</div>
</>) : null}
<div style={{ fontSize: "12px", color: "#5C6168", display: "flex", justifyContent: "space-between", gap: "8px" }}>
<span>
{rv.round}
</span>
<span>
{rv.immutable}
</span>
</div>
{rv.isResub ? (<>
<div style={{ fontSize: "12.5px", border: "1px solid #EBD3A0", background: "#FFFBF2", borderRadius: "4px", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "6px" }}>
<div style={{ fontWeight: "600", color: "#6B4600" }}>
{t.prevReturn}
</div>
<div>
{rv.prevReason}
</div>
{(rv.prev || []).map((p: any, __i: number) => (<Fragment key={__i}>
<div style={{ borderTop: "1px solid #F1E2C2", paddingTop: "6px" }}>
<div>
<span style={{ fontFamily: "'IBM Plex Mono',monospace", color: "#8A5A00" }}>
{p.num}
</span>
 {p.text}
</div>
<div style={{ color: "#5C6168" }}>
{t.nowAnswer}: 
<b style={{ color: "#191C1F" }}>
{p.now}
</b>
 · {p.note}
</div>
</div>
</Fragment>))}
</div>
</>) : null}
{rv.isRejected ? (<>
<div style={{ fontSize: "13px", background: "#F7E2E1", color: "#5A1416", borderRadius: "4px", padding: "10px 12px" }}>
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
<div style={{ fontSize: "13px", background: "#ECE6F5", color: "#3A2560", borderRadius: "4px", padding: "10px 12px" }}>
<div style={{ fontWeight: "600" }}>
{rv.reviewedBy}
</div>
{rv.reviewedNote}
</div>
</>) : null}
{rv.canDecide ? (<>
<div style={{ fontSize: "13px", color: "#5C6168" }}>
{rv.hint}
</div>
{rv.hasFlags ? (<>
<div style={{ fontSize: "13px", color: "#6B4600", fontWeight: "500" }}>
{rv.flagTxt}
</div>
</>) : null}
<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
{rv.canApprove ? (<>
<button onClick={rv.approve} style={{ height: "44px", border: "0", borderRadius: "4px", background: "#0F5C4A", color: "#fff", fontWeight: "500", cursor: "pointer" }}>
{t.approveInsp}
</button>
</>) : null}
{rv.canForward ? (<>
<button onClick={rv.forward} style={{ height: "44px", border: "0", borderRadius: "4px", background: "#0F5C4A", color: "#fff", fontWeight: "500", cursor: "pointer" }}>
{t.forwardApproval}
</button>
</>) : null}
<button onClick={rv.ret} style={{ height: "44px", border: "1px solid #E5C98F", borderRadius: "4px", background: "#fff", color: "#8A5A00", fontWeight: "500", cursor: "pointer" }}>
{t.returnCompletion}
</button>
<button onClick={rv.reject} style={{ height: "44px", border: "1px solid #E8C4C2", borderRadius: "4px", background: "#fff", color: "#A3262A", fontWeight: "500", cursor: "pointer" }}>
{t.rejectInsp}
</button>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", color: "#5C6168", borderTop: "1px solid #EFEDE7", paddingTop: "8px" }}>
<div>
<b style={{ color: "#8A5A00" }}>
{t.returnCompletion}
</b>
 — {rv.retExplain}
</div>
<div>
<b style={{ color: "#A3262A" }}>
{t.rejectInsp}
</b>
 — {rv.rejExplain}
</div>
{rv.canForward ? (<>
<div>
<b style={{ color: "#0F5C4A" }}>
{t.forwardApproval}
</b>
 — {rv.fwdExplain}
</div>
</>) : null}
{rv.canApprove ? (<>
<div>
<b style={{ color: "#0F5C4A" }}>
{t.approveInsp}
</b>
 — {rv.appExplain}
</div>
</>) : null}
</div>
{rv.noApproveNote ? (<>
<div style={{ fontSize: "12px", color: "#8B9097" }}>
{t.noApproveAuthority}
</div>
</>) : null}
</>) : null}
{rv.readOnly ? (<>
<div style={{ fontSize: "13px", color: "#3D4247" }}>
{rv.roMsg}
</div>
{rv.hasReport ? (<>
<button onClick={rv.report} style={{ height: "44px", border: "0", borderRadius: "4px", background: "#0F5C4A", color: "#fff", fontWeight: "500", cursor: "pointer" }}>
{t.viewReport}
</button>
</>) : null}
</>) : null}
</section>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px", padding: "16px 18px" }}>
<h2 style={{ margin: "0 0 14px", fontSize: "15px", fontWeight: "600" }}>
{t.workflowHistory}
</h2>
{(rv.timeline || []).map((h: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "grid", gridTemplateColumns: "14px 1fr", gap: "10px" }}>
<div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
<span style={{ width: "10px", height: "10px", borderRadius: "50%", background: h.c, marginTop: "5px", flexShrink: "0" }}></span>
<span style={{ flex: "1", width: "1px", background: "#E3E1DA", marginTop: "4px" }}></span>
</div>
<div style={{ paddingBottom: "14px", minWidth: "0" }}>
<div style={{ fontWeight: "500", fontSize: "13.5px" }}>
{h.label}
</div>
<div style={{ fontSize: "12px", color: "#5C6168" }}>
{h.actor} · {h.role} · {h.at}
</div>
{h.hasReason ? (<>
<div style={{ marginTop: "6px", fontSize: "13px", background: "#FAF9F6", border: "1px solid #EFEDE7", borderRadius: "4px", padding: "8px 10px" }}>
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
