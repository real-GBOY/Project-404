/* eslint-disable */
// GENERATED from the approved Claude Design (Raqib.dc.html) by tools/transpile — do not hand-edit.
import { Fragment } from "react";
import type { VM } from "@/ui/vm";

export function VisitDetail({ vm }: { vm: VM }) {
  const { arrBack, mainCols, pad, t, vd } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "1240px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
<button onClick={vd.back} style={{ alignSelf: "flex-start", background: "none", border: "0", padding: "0", color: "#0F5C4A", fontSize: "13px", cursor: "pointer" }}>
{arrBack} {t.back}
</button>
<div style={{ display: "flex", justifyContent: "space-between", gap: "12px 20px", flexWrap: "wrap", alignItems: "flex-end" }}>
<div>
<div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
<span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "12.5px", color: "#5C6168" }}>
{vd.ref}
</span>
<span style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", fontWeight: "500", color: vd.st.fg, background: vd.st.bg }}>
<span style={{ width: "6px", height: "6px", borderRadius: "50%", background: vd.st.fg }}></span>
{vd.st.label}
</span>
</div>
<h1 style={{ margin: "2px 0 2px", fontSize: "22px", fontWeight: "600" }}>
{vd.title}
</h1>
<div style={{ fontSize: "13px", color: "#5C6168" }}>
{vd.proj} · {vd.wd} {vd.date} · {vd.time}
</div>
{vd.hasScore ? (<>
<div style={{ fontSize: "13px", color: "#3D4247", marginTop: "4px" }}>
{vd.scoreLine}
</div>
</>) : null}
</div>
<div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
{vd.canManage ? (<>
<button onClick={vd.cancel} style={{ height: "40px", padding: "0 14px", border: "1px solid #E8C4C2", borderRadius: "4px", background: "#fff", color: "#A3262A", cursor: "pointer" }}>
{t.cancelVisit}
</button>
<button onClick={vd.resched} style={{ height: "40px", padding: "0 14px", border: "1px solid #D6D3CB", borderRadius: "4px", background: "#fff", cursor: "pointer" }}>
{t.reschedule}
</button>
</>) : null}
{vd.canReview ? (<>
<button onClick={vd.review} style={{ height: "40px", padding: "0 16px", border: "0", borderRadius: "4px", background: "#0F5C4A", color: "#fff", fontWeight: "500", cursor: "pointer" }}>
{t.openReview}
</button>
</>) : null}
{vd.canSeeResult ? (<>
<button onClick={vd.result} style={{ height: "40px", padding: "0 16px", border: "1px solid #D6D3CB", borderRadius: "4px", background: "#fff", cursor: "pointer" }}>
{t.viewResults}
</button>
</>) : null}
{vd.hasReport ? (<>
<button onClick={vd.report} style={{ height: "40px", padding: "0 16px", border: "1px solid #D6D3CB", borderRadius: "4px", background: "#fff", cursor: "pointer" }}>
{t.viewReport}
</button>
</>) : null}
{vd.canStart ? (<>
<button onClick={vd.start} style={{ height: "44px", padding: "0 20px", border: "0", borderRadius: "4px", background: "#0F5C4A", color: "#fff", fontWeight: "500", cursor: "pointer", fontSize: "15px" }}>
{vd.startLabel}
</button>
</>) : null}
</div>
</div>
{vd.isReturned ? (<>
<div style={{ background: "#FAEFD8", border: "1px solid #EBD3A0", borderRadius: "6px", padding: "12px 16px", color: "#3D2A00", fontSize: "13.5px" }}>
<div style={{ fontWeight: "600", color: "#6B4600" }}>
{t.returnedReason}
</div>
{vd.returnReason}
<div style={{ fontSize: "12px", marginTop: "6px" }}>
{vd.returnMeta}
</div>
</div>
</>) : null}
{vd.isRejected ? (<>
<div style={{ background: "#F7E2E1", border: "1px solid #E8C4C2", borderRadius: "6px", padding: "12px 16px", color: "#5A1416", fontSize: "13.5px" }}>
<div style={{ fontWeight: "600" }}>
{t.rejectedReason}
</div>
{vd.rejectReason}
<div style={{ fontSize: "12px", marginTop: "6px" }}>
{vd.rejectMeta}
</div>
</div>
</>) : null}
{vd.isCancelled ? (<>
<div style={{ background: "#ECEAE5", borderRadius: "6px", padding: "12px 16px", fontSize: "13.5px" }}>
<div style={{ fontWeight: "600" }}>
{t.cancelledReason}
</div>
{vd.cancelReason}
<div style={{ fontSize: "12px", marginTop: "6px" }}>
{vd.cancelMeta}
</div>
</div>
</>) : null}
<div style={{ display: "grid", gridTemplateColumns: mainCols, gap: "20px", alignItems: "start" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "20px", minWidth: "0" }}>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 18px", borderBottom: "1px solid #EFEDE7" }}>
{t.visitDetails}
</h2>
<dl style={{ margin: "0", display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))" }}>
{(vd.details || []).map((d: any, __i: number) => (<Fragment key={__i}>
<div style={{ padding: "12px 18px", borderBottom: "1px solid #F3F1EC" }}>
<dt style={{ fontSize: "12px", color: "#8B9097" }}>
{d.k}
</dt>
<dd style={{ margin: "2px 0 0", fontSize: "13.5px", fontWeight: "500" }}>
{d.v}
</dd>
</div>
</Fragment>))}
</dl>
</section>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 18px", borderBottom: "1px solid #EFEDE7" }}>
{t.guardsOnShift}
</h2>
{(vd.guards || []).map((g: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "flex", gap: "12px", alignItems: "center", padding: "12px 18px", borderBottom: "1px solid #F3F1EC" }}>
<span style={{ flex: "1" }}>
<span style={{ display: "block", fontWeight: "500" }}>
{g.name}
</span>
<span style={{ display: "block", fontSize: "12px", color: "#8B9097" }}>
<span style={{ fontFamily: "'IBM Plex Mono',monospace" }}>
{g.emp}
</span>
 · {g.post}
</span>
</span>
<span style={{ fontWeight: "600", color: g.scoreC, fontSize: "13px" }}>
{g.score}
</span>
</div>
</Fragment>))}
{vd.noGuards ? (<>
<div style={{ padding: "14px 18px", fontSize: "13px", color: "#5C6168" }}>
{t.noGuardsAssigned}
</div>
</>) : null}
</section>
</div>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px", padding: "16px 18px" }}>
<h2 style={{ margin: "0 0 14px", fontSize: "15px", fontWeight: "600" }}>
{t.workflowHistory}
</h2>
{(vd.timeline || []).map((h: any, __i: number) => (<Fragment key={__i}>
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
</>);
}
