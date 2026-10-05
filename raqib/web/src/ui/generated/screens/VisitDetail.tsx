/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import { Fragment } from "react";
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";
import { FONT } from "@/styles/typography";

export function VisitDetail({ vm }: { vm: VM }) {
  const { arrBack, mainCols, pad, t, vd } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "1240px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
<button onClick={vd.back} style={{ alignSelf: "flex-start", background: "none", border: "0", padding: "0", color: C.brand.primary, fontSize: "13px", cursor: "pointer" }}>
{arrBack} {t.back}
</button>
<div style={{ display: "flex", justifyContent: "space-between", gap: "12px 20px", flexWrap: "wrap", alignItems: "flex-end" }}>
<div>
<div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
<span style={{ fontFamily: FONT.mono, fontSize: "12.5px", color: C.text.secondary }}>
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
<div style={{ fontSize: "13px", color: C.text.secondary }}>
{vd.proj} · {vd.wd} {vd.date} · {vd.time}
</div>
{vd.hasScore ? (<>
<div style={{ fontSize: "13px", color: C.text.body, marginTop: "4px" }}>
{vd.scoreLine}
</div>
</>) : null}
</div>
<div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
{vd.canManage ? (<>
<button onClick={vd.cancel} style={{ height: "40px", padding: "0 14px", border: `1px solid ${C.status.danger.border}`, borderRadius: "4px", background: C.surface.white, color: C.status.danger.fg, cursor: "pointer" }}>
{t.cancelVisit}
</button>
<button onClick={vd.resched} style={{ height: "40px", padding: "0 14px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, cursor: "pointer" }}>
{t.reschedule}
</button>
</>) : null}
{vd.canReview ? (<>
<button onClick={vd.review} style={{ height: "40px", padding: "0 16px", border: "0", borderRadius: "4px", background: C.brand.primary, color: C.surface.white, fontWeight: "500", cursor: "pointer" }}>
{t.openReview}
</button>
</>) : null}
{vd.canSeeResult ? (<>
<button onClick={vd.result} style={{ height: "40px", padding: "0 16px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, cursor: "pointer" }}>
{t.viewResults}
</button>
</>) : null}
{vd.hasReport ? (<>
<button onClick={vd.report} style={{ height: "40px", padding: "0 16px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, cursor: "pointer" }}>
{t.viewReport}
</button>
</>) : null}
{vd.canStart ? (<>
<button onClick={vd.start} style={{ height: "44px", padding: "0 20px", border: "0", borderRadius: "4px", background: C.brand.primary, color: C.surface.white, fontWeight: "500", cursor: "pointer", fontSize: "15px" }}>
{vd.startLabel}
</button>
</>) : null}
</div>
</div>
{vd.isReturned ? (<>
<div style={{ background: C.status.warning.bg, border: `1px solid ${C.status.warning.border}`, borderRadius: "6px", padding: "12px 16px", color: C.status.warning.deep, fontSize: "13.5px" }}>
<div style={{ fontWeight: "600", color: C.status.warning.strong }}>
{t.returnedReason}
</div>
{vd.returnReason}
<div style={{ fontSize: "12px", marginTop: "6px" }}>
{vd.returnMeta}
</div>
</div>
</>) : null}
{vd.isRejected ? (<>
<div style={{ background: C.status.danger.bg, border: `1px solid ${C.status.danger.border}`, borderRadius: "6px", padding: "12px 16px", color: C.status.danger.deep, fontSize: "13.5px" }}>
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
<div style={{ background: C.surface.sunken, borderRadius: "6px", padding: "12px 16px", fontSize: "13.5px" }}>
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
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 18px", borderBottom: `1px solid ${C.surface.track}` }}>
{t.visitDetails}
</h2>
<dl style={{ margin: "0", display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))" }}>
{(vd.details || []).map((d: any, __i: number) => (<Fragment key={__i}>
<div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.surface.subtle}` }}>
<dt style={{ fontSize: "12px", color: C.text.muted }}>
{d.k}
</dt>
<dd style={{ margin: "2px 0 0", fontSize: "13.5px", fontWeight: "500" }}>
{d.v}
</dd>
</div>
</Fragment>))}
</dl>
</section>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 18px", borderBottom: `1px solid ${C.surface.track}` }}>
{t.guardsOnShift}
</h2>
{(vd.guards || []).map((g: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "flex", gap: "12px", alignItems: "center", padding: "12px 18px", borderBottom: `1px solid ${C.surface.subtle}` }}>
<span style={{ flex: "1" }}>
<span style={{ display: "block", fontWeight: "500" }}>
{g.name}
</span>
<span style={{ display: "block", fontSize: "12px", color: C.text.muted }}>
<span style={{ fontFamily: FONT.mono }}>
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
<div style={{ padding: "14px 18px", fontSize: "13px", color: C.text.secondary }}>
{t.noGuardsAssigned}
</div>
</>) : null}
</section>
</div>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px", padding: "16px 18px" }}>
<h2 style={{ margin: "0 0 14px", fontSize: "15px", fontWeight: "600" }}>
{t.workflowHistory}
</h2>
{(vd.timeline || []).map((h: any, __i: number) => (<Fragment key={__i}>
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
</>);
}
