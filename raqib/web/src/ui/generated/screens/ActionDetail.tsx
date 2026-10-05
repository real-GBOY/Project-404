/* eslint-disable */
// GENERATED from the approved Claude Design (Raqib.dc.html) by tools/transpile — do not hand-edit.
import { Fragment } from "react";
import type { VM } from "@/ui/vm";

export function ActionDetail({ vm }: { vm: VM }) {
  const { ad, arr, arrBack, mainCols, pad, t } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "1240px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
<button onClick={ad.back} style={{ alignSelf: "flex-start", background: "none", border: "0", padding: "0", color: "#0F5C4A", fontSize: "13px", cursor: "pointer" }}>
{arrBack} {t.nav_actions_l}
</button>
<div>
<div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
<span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "12.5px", color: "#5C6168" }}>
{ad.ref}
</span>
<span style={{ height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", fontWeight: "500", color: ad.st.fg, background: ad.st.bg, display: "inline-flex", alignItems: "center" }}>
{ad.st.label}
</span>
<span style={{ height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", color: ad.pri.fg, background: ad.pri.bg, display: "inline-flex", alignItems: "center" }}>
{t.priority}: {ad.pri.label}
</span>
{ad.hasRep ? (<>
<span style={{ height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", color: "#8A5A00", background: "#FAEFD8", display: "inline-flex", alignItems: "center" }}>
{ad.rep}
</span>
</>) : null}
{ad.isOverdue ? (<>
<span style={{ height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", fontWeight: "600", color: "#fff", background: "#A3262A", display: "inline-flex", alignItems: "center" }}>
{ad.overdueTxt}
</span>
</>) : null}
</div>
<h1 style={{ margin: "4px 0 0", fontSize: "22px", fontWeight: "600" }}>
{ad.t}
</h1>
</div>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px", padding: "18px" }}>
{ad.stepH ? (<>
<div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))" }}>
{(ad.steps || []).map((st: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: "0" }}>
<div style={{ display: "flex", alignItems: "center" }}>
<span style={{ width: "22px", height: "22px", borderRadius: "50%", background: st.dot, border: `2px solid ${st.dbd}`, color: "#fff", fontSize: "11px", fontWeight: "700", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>
{st.mark}
</span>
<span style={{ flex: "1", height: "2px", background: st.line, margin: "0 6px" }}></span>
</div>
<div style={{ paddingInlineEnd: "8px" }}>
<div style={{ fontSize: "13px", fontWeight: st.fw, color: st.fg }}>
{st.label}
</div>
<div style={{ fontSize: "11.5px", color: "#8B9097" }}>
{st.sub}
</div>
</div>
</div>
</Fragment>))}
</div>
</>) : null}
{ad.stepVertical ? (<>
{(ad.steps || []).map((st: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "flex", gap: "12px", alignItems: "flex-start", padding: "4px 0" }}>
<span style={{ width: "20px", height: "20px", borderRadius: "50%", background: st.dot, border: `2px solid ${st.dbd}`, color: "#fff", fontSize: "10px", fontWeight: "700", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>
{st.mark}
</span>
<span>
<span style={{ display: "block", fontSize: "13.5px", fontWeight: st.fw, color: st.fg }}>
{st.label}
</span>
<span style={{ display: "block", fontSize: "12px", color: "#8B9097" }}>
{st.sub}
</span>
</span>
</div>
</Fragment>))}
</>) : null}
</section>
{ad.isReturned ? (<>
<div style={{ background: "#FAEFD8", border: "1px solid #EBD3A0", borderRadius: "6px", padding: "12px 16px", fontSize: "13.5px", color: "#3D2A00" }}>
<div style={{ fontWeight: "600", color: "#6B4600" }}>
{t.caReturnedTitle}
</div>
{ad.retReason}
</div>
</>) : null}
<div style={{ display: "grid", gridTemplateColumns: mainCols, gap: "20px", alignItems: "start" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: "0" }}>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 18px", borderBottom: "1px solid #EFEDE7" }}>
{t.caDetails}
</h2>
<dl style={{ margin: "0", display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))" }}>
{(ad.details || []).map((d: any, __i: number) => (<Fragment key={__i}>
<div style={{ padding: "11px 18px", borderBottom: "1px solid #F3F1EC" }}>
<dt style={{ fontSize: "12px", color: "#8B9097" }}>
{d.k}
</dt>
<dd style={{ margin: "2px 0 0", fontSize: "13.5px", fontWeight: "500" }}>
{d.v}
</dd>
</div>
</Fragment>))}
</dl>
<div style={{ padding: "10px 18px" }}>
<button onClick={ad.goSource} style={{ background: "none", border: "0", padding: "0", color: "#0F5C4A", fontSize: "13px", cursor: "pointer" }}>
{t.openSourceInsp} {arr}
</button>
</div>
</section>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px", padding: "16px 18px", display: "flex", flexDirection: "column", gap: "12px" }}>
<div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600" }}>
{t.closureEvidence}
</h2>
{ad.canEv ? (<>
<div style={{ display: "flex", gap: "8px" }}>
<button onClick={ad.capture} style={{ height: "38px", padding: "0 14px", border: "1px solid #0F5C4A", borderRadius: "4px", background: "#fff", color: "#0F5C4A", cursor: "pointer" }}>
{t.capturePhoto}
</button>
<button onClick={ad.upload} style={{ height: "38px", padding: "0 14px", border: "1px solid #D6D3CB", borderRadius: "4px", background: "#fff", cursor: "pointer" }}>
{t.uploadFile}
</button>
</div>
</>) : null}
</div>
{ad.hasEv ? (<>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: "8px" }}>
{(ad.ev || []).map((e: any, __i: number) => (<Fragment key={__i}>
<div style={{ border: "1px solid #E3E1DA", borderRadius: "4px", overflow: "hidden" }}>
<div onClick={e.open} style={{ height: "84px", position: "relative", cursor: "pointer", background: "repeating-linear-gradient(135deg,#F0EEE8 0 8px,#E8E5DE 8px 16px)", display: "flex", alignItems: "center", justifyContent: "center" }} role="button" tabIndex={0} onKeyDown={(e: any) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (e.open)(e); } }}>
{e.hasUrl ? (<>
<div style={{ position: "absolute", inset: "0", backgroundPosition: "center", backgroundSize: "cover", backgroundRepeat: "no-repeat", backgroundImage: e.bgImg }}></div>
</>) : null}
<span style={{ position: "relative", fontFamily: "'IBM Plex Mono',monospace", fontSize: "10.5px", background: "rgba(255,255,255,.85)", padding: "2px 6px", borderRadius: "2px" }}>
{e.kindLabel}
</span>
</div>
<div style={{ padding: "7px 9px", display: "flex", flexDirection: "column", gap: "3px" }}>
<div dir="ltr" style={{ fontSize: "12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "start" }}>
{e.name}
</div>
<div style={{ fontSize: "11px", color: e.stC }}>
{e.meta}
</div>
{e.busy ? (<>
<div style={{ height: "3px", background: "#EFEDE7", borderRadius: "2px", overflow: "hidden" }}>
<div style={{ height: "100%", width: e.pW, background: "#1F4E8C" }}></div>
</div>
</>) : null}
<div style={{ display: "flex", gap: "12px" }}>
{e.failed ? (<>
<button onClick={e.retry} style={{ background: "none", border: "0", padding: "2px 0", color: "#0F5C4A", fontSize: "12px", cursor: "pointer" }}>
{t.retry}
</button>
</>) : null}
{e.canRemove ? (<>
<button onClick={e.remove} style={{ background: "none", border: "0", padding: "2px 0", color: "#A3262A", fontSize: "12px", cursor: "pointer" }}>
{t.remove}
</button>
</>) : null}
</div>
</div>
</div>
</Fragment>))}
</div>
</>) : null}
{ad.noEv ? (<>
<div style={{ fontSize: "13px", color: "#5C6168", padding: "14px", border: "1px dashed #D6D3CB", borderRadius: "4px", textAlign: "center" }}>
{t.noEvidenceYet}
</div>
</>) : null}
{ad.canStart ? (<>
<div style={{ fontSize: "13px", color: "#3D4247" }}>
{t.startHint}
</div>
<button onClick={ad.start} style={{ alignSelf: "flex-start", height: "42px", padding: "0 18px", border: "0", borderRadius: "4px", background: "#0F5C4A", color: "#fff", fontWeight: "500", cursor: "pointer" }}>
{t.startWork}
</button>
</>) : null}
{ad.canEv ? (<>
<button onClick={ad.submitEv} style={{ alignSelf: "flex-start", height: "42px", padding: "0 18px", border: "0", borderRadius: "4px", background: "#0F5C4A", color: "#fff", fontWeight: "500", cursor: "pointer" }}>
{t.submitForReview}
</button>
</>) : null}
</section>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 18px", borderBottom: "1px solid #EFEDE7" }}>
{t.commentsHistory}
</h2>
{(ad.log || []).map((l: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "flex", gap: "12px", padding: "12px 18px", borderBottom: "1px solid #F3F1EC" }}>
<span style={{ width: "30px", height: "30px", borderRadius: "50%", background: "#ECEAE5", fontSize: "11px", fontWeight: "600", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>
{l.ini}
</span>
<div style={{ minWidth: "0" }}>
<div style={{ fontSize: "12px", color: "#5C6168" }}>
<span style={{ fontWeight: "600", color: "#191C1F" }}>
{l.by}
</span>
 · {l.role} · {l.at}
</div>
<div style={{ fontSize: "13.5px", marginTop: "2px" }}>
{l.txt}
</div>
</div>
</div>
</Fragment>))}
<div style={{ padding: "12px 18px", display: "flex", gap: "8px" }}>
<input value={ad.comment} onChange={ad.onComment} placeholder={t.commentPh} style={{ flex: "1", height: "40px", border: "1px solid #D6D3CB", borderRadius: "4px", padding: "0 12px", fontSize: "14px" }} />
<button onClick={ad.addComment} style={{ height: "40px", padding: "0 14px", border: "1px solid #D6D3CB", borderRadius: "4px", background: "#fff", cursor: "pointer" }}>
{t.send}
</button>
</div>
</section>
</div>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px", padding: "18px", display: "flex", flexDirection: "column", gap: "12px", position: "sticky", top: "16px" }}>
<div style={{ fontWeight: "600", fontSize: "15px" }}>
{t.qualityReview}
</div>
{ad.canReview ? (<>
<div style={{ fontSize: "13px", color: "#5C6168" }}>
{t.caReviewHint}
</div>
{ad.canClose ? (<>
<button onClick={ad.approve} style={{ height: "44px", border: "0", borderRadius: "4px", background: "#0F5C4A", color: "#fff", fontWeight: "500", cursor: "pointer" }}>
{t.approveClosure}
</button>
</>) : null}
<button onClick={ad.ret} style={{ height: "44px", border: "1px solid #E5C98F", borderRadius: "4px", background: "#fff", color: "#8A5A00", fontWeight: "500", cursor: "pointer" }}>
{t.returnToResp}
</button>
{ad.noCloseNote ? (<>
<div style={{ fontSize: "12px", color: "#8B9097" }}>
{t.noCloseAuthority}
</div>
</>) : null}
</>) : null}
{ad.waiting ? (<>
<div style={{ fontSize: "13px", color: "#3D4247" }}>
{ad.waitTxt}
</div>
</>) : null}
{ad.hasDecisions ? (<>
<div style={{ borderTop: "1px solid #EFEDE7", paddingTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
<div style={{ fontSize: "12px", color: "#8B9097" }}>
{t.reviewHistory}
</div>
{(ad.decisions || []).map((d: any, __i: number) => (<Fragment key={__i}>
<div style={{ fontSize: "12.5px", borderInlineStart: `3px solid ${d.c}`, paddingInlineStart: "8px" }}>
<div style={{ fontWeight: "600" }}>
{d.d}
</div>
<div style={{ color: "#5C6168" }}>
{d.by} · {d.role} · {d.at}
</div>
<div>
{d.txt}
</div>
</div>
</Fragment>))}
</div>
</>) : null}
{ad.isClosed ? (<>
<div style={{ fontSize: "13px", color: "#1E6B45", background: "#E3F0E7", padding: "10px 12px", borderRadius: "4px", fontWeight: "500" }}>
{t.caClosedMsg}
</div>
</>) : null}
</section>
</div>
</div>
</>);
}
