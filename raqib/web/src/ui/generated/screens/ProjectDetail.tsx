/* eslint-disable */
// GENERATED from the approved Claude Design (Raqib.dc.html) by tools/transpile — do not hand-edit.
import { Fragment } from "react";
import { Hover } from "@/ui/Hover";
import type { VM } from "@/ui/vm";

export function ProjectDetail({ vm }: { vm: VM }) {
  const { arrBack, mainCols, pad, pd, pt, t } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "1360px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
<button onClick={pd.back} style={{ alignSelf: "flex-start", background: "none", border: "0", padding: "0", color: "#0F5C4A", fontSize: "13px", cursor: "pointer" }}>
{arrBack} {t.nav_projects_l}
</button>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "12px 20px", flexWrap: "wrap" }}>
<div>
<div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
<span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "12.5px", color: "#5C6168" }}>
{pd.code}
</span>
<span style={{ display: "inline-flex", alignItems: "center", height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", fontWeight: "500", color: pd.st.fg, background: pd.st.bg }}>
{pd.st.label}
</span>
</div>
<h1 style={{ margin: "2px 0 4px", fontSize: "24px", fontWeight: "600" }}>
{pd.name}
</h1>
<div style={{ fontSize: "13px", color: "#5C6168", display: "flex", gap: "6px 16px", flexWrap: "wrap" }}>
<span>
{t.c_manager}: {pd.mgr}
</span>
<span>
{pd.city}
</span>
<span>
{pd.sites}
</span>
<span>
{pd.guards}
</span>
</div>
</div>
{pd.canSchedule ? (<>
<button onClick={pd.schedule} style={{ height: "40px", padding: "0 16px", border: "0", borderRadius: "4px", background: "#0F5C4A", color: "#fff", fontWeight: "500", cursor: "pointer" }}>
{t.scheduleVisit}
</button>
</>) : null}
</div>
<div style={{ display: "flex", gap: "4px", borderBottom: "1px solid #E3E1DA", overflowX: "auto" }}>
{(pd.tabs || []).map((tb: any, __i: number) => (<Fragment key={__i}>
<button onClick={tb.go} style={{ height: "42px", padding: "0 14px", border: "0", borderBottom: `2px solid ${tb.bd}`, background: "none", color: tb.fg, fontWeight: tb.fw, fontSize: "13.5px", cursor: "pointer", whiteSpace: "nowrap", marginBottom: "-1px" }}>
{tb.label}
</button>
</Fragment>))}
</div>
{pd.empty ? (<>
<div style={{ background: "#fff", border: "1px dashed #D6D3CB", borderRadius: "6px", padding: "40px 20px", textAlign: "center" }}>
<div style={{ fontWeight: "600" }}>
{t.projEmptyTitle}
</div>
<div style={{ fontSize: "13px", color: "#5C6168", marginTop: "4px" }}>
{pd.emptyTxt}
</div>
</div>
</>) : null}
{pd.notEmpty ? (<>
{pt.overview ? (<>
<div style={{ display: "grid", gridTemplateColumns: mainCols, gap: "20px", alignItems: "start" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "20px", minWidth: "0" }}>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px", padding: "18px", display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-end" }}>
<div style={{ minWidth: "160px" }}>
<div style={{ fontSize: "13px", color: "#5C6168" }}>
{t.projCompliance}
</div>
<div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
<span style={{ fontSize: "44px", fontWeight: "600", lineHeight: "1.1", color: pd.scoreC }}>
{pd.scoreTxt}
</span>
<span style={{ fontSize: "18px", color: pd.scoreC }}>
%
</span>
</div>
<div style={{ fontSize: "13px", color: pd.deltaC }}>
{pd.delta}
</div>
<div style={{ fontSize: "12px", color: "#5C6168", marginTop: "10px" }}>
{pd.completion}
</div>
<div style={{ height: "4px", background: "#EFEDE7", borderRadius: "2px", overflow: "hidden", marginTop: "4px", width: "160px" }}>
<div style={{ height: "100%", width: pd.compW, background: "#0F5C4A" }}></div>
</div>
</div>
<div style={{ flex: "1", minWidth: "260px" }}>
<div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "110px", borderBottom: "1px solid #E3E1DA" }}>
{(pd.weeks || []).map((w: any, __i: number) => (<Fragment key={__i}>
<div style={{ flex: "1", height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: "3px" }}>
<span style={{ fontSize: "10px", color: "#8B9097" }}>
{w.v}
</span>
<div style={{ width: "100%", maxWidth: "22px", height: w.h, background: w.c, borderRadius: "1px" }}></div>
</div>
</Fragment>))}
</div>
<div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
{(pd.weeks || []).map((w: any, __i: number) => (<Fragment key={__i}>
<span style={{ flex: "1", fontSize: "10.5px", color: "#8B9097", textAlign: "center", whiteSpace: "nowrap" }}>
{w.lbl}
</span>
</Fragment>))}
</div>
</div>
</section>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 18px", borderBottom: "1px solid #EFEDE7" }}>
{t.sitePerformance}
</h2>
{(pd.siteRows || []).map((x: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(120px,200px)", gap: "16px", alignItems: "center", padding: "11px 18px", borderBottom: "1px solid #F3F1EC" }}>
<div style={{ minWidth: "0" }}>
<div style={{ fontWeight: "500" }}>
{x.n}
</div>
<div style={{ fontSize: "12px", color: "#8B9097" }}>
{x.areas}
</div>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<div style={{ flex: "1", height: "6px", background: "#EFEDE7", borderRadius: "3px", overflow: "hidden" }}>
<div style={{ height: "100%", width: x.scoreW, background: x.scoreC }}></div>
</div>
<span style={{ fontWeight: "600", color: x.scoreC, minWidth: "36px" }}>
{x.scoreTxt}
</span>
</div>
</div>
</Fragment>))}
</section>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 18px", borderBottom: "1px solid #EFEDE7" }}>
{t.recentInspections}
</h2>
{(pd.recent || []).map((v: any, __i: number) => (<Fragment key={__i}>
<Hover as="button" onClick={v.go} style={{ width: "100%", display: "flex", gap: "12px", alignItems: "center", padding: "11px 18px", border: "0", borderBottom: "1px solid #F3F1EC", background: "#fff", cursor: "pointer", textAlign: "start", flexWrap: "wrap" }} hover={{ background: "#FAF9F6" }}>
<span style={{ flex: "1", minWidth: "200px" }}>
<span style={{ display: "block", fontWeight: "500" }}>
{v.site} — {v.area}
</span>
<span style={{ display: "block", fontSize: "12px", color: "#8B9097" }}>
<span style={{ fontFamily: "'IBM Plex Mono',monospace" }}>
{v.ref}
</span>
 · {v.date} · {v.ins}
</span>
</span>
<span style={{ fontWeight: "600", color: v.scoreC }}>
{v.score}
</span>
<span style={{ height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", fontWeight: "500", color: v.st.fg, background: v.st.bg, display: "inline-flex", alignItems: "center" }}>
{v.st.label}
</span>
</Hover>
</Fragment>))}
</section>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "20px", minWidth: "0" }}>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 18px", borderBottom: "1px solid #EFEDE7" }}>
{t.needsAttention}
</h2>
{(pd.attn || []).map((a: any, __i: number) => (<Fragment key={__i}>
<Hover as="button" onClick={a.go} style={{ width: "100%", display: "flex", gap: "10px", padding: "12px 18px", border: "0", borderBottom: "1px solid #F3F1EC", background: "#fff", cursor: "pointer", textAlign: "start" }} hover={{ background: "#FAF9F6" }}>
<span style={{ width: "8px", height: "8px", borderRadius: "50%", background: a.c, marginTop: "6px", flexShrink: "0" }}></span>
<span>
<span style={{ display: "block", fontWeight: "500", fontSize: "13.5px" }}>
{a.t}
</span>
<span style={{ display: "block", fontSize: "12.5px", color: "#5C6168" }}>
{a.sub}
</span>
</span>
</Hover>
</Fragment>))}
{pd.noAttn ? (<>
<div style={{ padding: "16px 18px", fontSize: "13px", color: "#5C6168" }}>
{t.nothingAttention}
</div>
</>) : null}
</section>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 18px", borderBottom: "1px solid #EFEDE7" }}>
{t.openCAs}
</h2>
{(pd.openCas || []).map((a: any, __i: number) => (<Fragment key={__i}>
<Hover as="button" onClick={a.go} style={{ width: "100%", display: "flex", gap: "10px", alignItems: "flex-start", padding: "12px 18px", border: "0", borderBottom: "1px solid #F3F1EC", background: "#fff", cursor: "pointer", textAlign: "start" }} hover={{ background: "#FAF9F6" }}>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13.5px", fontWeight: "500" }}>
{a.t}
</span>
<span style={{ display: "block", fontSize: "12px", color: "#8B9097" }}>
<span style={{ fontFamily: "'IBM Plex Mono',monospace" }}>
{a.ref}
</span>
 · {a.resp}
</span>
</span>
<span style={{ fontSize: "12px", color: a.dueC, textAlign: "end", whiteSpace: "nowrap" }}>
{a.dueSub}
</span>
</Hover>
</Fragment>))}
</section>
</div>
</div>
</>) : null}
{pt.sites ? (<>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
{(pd.siteRows || []).map((x: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "flex", gap: "16px", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid #F3F1EC", flexWrap: "wrap" }}>
<div style={{ flex: "1", minWidth: "200px" }}>
<div style={{ fontWeight: "600" }}>
{x.n}
</div>
<div style={{ fontSize: "12.5px", color: "#5C6168" }}>
{t.areas}: {x.areas}
</div>
</div>
<span style={{ fontSize: "12.5px", color: "#5C6168" }}>
{t.k_visits} {x.vis} · {t.c_openObs} {x.obs}
</span>
<span style={{ fontWeight: "600", color: x.scoreC, minWidth: "44px", textAlign: "end" }}>
{x.scoreTxt}
</span>
</div>
</Fragment>))}
</section>
</>) : null}
{pt.visits ? (<>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
{(pd.visits || []).map((v: any, __i: number) => (<Fragment key={__i}>
<Hover as="button" onClick={v.go} style={{ width: "100%", display: "flex", gap: "12px", alignItems: "center", padding: "11px 18px", border: "0", borderBottom: "1px solid #F3F1EC", background: "#fff", cursor: "pointer", textAlign: "start", flexWrap: "wrap" }} hover={{ background: "#FAF9F6" }}>
<span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "12.5px", minWidth: "100px" }}>
{v.ref}
</span>
<span style={{ flex: "1", minWidth: "180px" }}>
<span style={{ display: "block", fontWeight: "500" }}>
{v.site} — {v.area}
</span>
<span style={{ display: "block", fontSize: "12px", color: "#8B9097" }}>
{v.date} {v.time} · {v.ins} · {v.type}
</span>
</span>
<span style={{ fontWeight: "600", color: v.scoreC }}>
{v.score}
</span>
<span style={{ height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", fontWeight: "500", color: v.st.fg, background: v.st.bg, display: "inline-flex", alignItems: "center" }}>
{v.st.label}
</span>
</Hover>
</Fragment>))}
</section>
</>) : null}
{pt.observations ? (<>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
{(pd.obs || []).map((o: any, __i: number) => (<Fragment key={__i}>
<Hover as="button" onClick={o.go} style={{ width: "100%", display: "flex", gap: "12px", alignItems: "center", padding: "12px 18px", border: "0", borderBottom: "1px solid #F3F1EC", background: "#fff", cursor: "pointer", textAlign: "start", flexWrap: "wrap" }} hover={{ background: "#FAF9F6" }}>
<span style={{ flex: "1", minWidth: "220px" }}>
<span style={{ display: "block", fontWeight: "500" }}>
{o.t}
</span>
<span style={{ display: "block", fontSize: "12px", color: "#8B9097" }}>
<span style={{ fontFamily: "'IBM Plex Mono',monospace" }}>
{o.ref}
</span>
 · {o.site} · {o.visit}
</span>
</span>
{o.hasRep ? (<>
<span style={{ fontFamily: "'IBM Plex Mono',monospace", color: "#8A5A00", fontWeight: "500" }}>
{o.rep}
</span>
</>) : null}
<span style={{ height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", color: o.sev.fg, background: o.sev.bg, display: "inline-flex", alignItems: "center" }}>
{o.sev.label}
</span>
<span style={{ height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", fontWeight: "500", color: o.st.fg, background: o.st.bg, display: "inline-flex", alignItems: "center" }}>
{o.st.label}
</span>
</Hover>
</Fragment>))}
</section>
</>) : null}
{pt.actions ? (<>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
{(pd.cas || []).map((a: any, __i: number) => (<Fragment key={__i}>
<Hover as="button" onClick={a.go} style={{ width: "100%", display: "flex", gap: "12px", alignItems: "center", padding: "12px 18px", border: "0", borderBottom: "1px solid #F3F1EC", background: "#fff", cursor: "pointer", textAlign: "start", flexWrap: "wrap" }} hover={{ background: "#FAF9F6" }}>
<span style={{ flex: "1", minWidth: "220px" }}>
<span style={{ display: "block", fontWeight: "500" }}>
{a.t}
</span>
<span style={{ display: "block", fontSize: "12px", color: "#8B9097" }}>
<span style={{ fontFamily: "'IBM Plex Mono',monospace" }}>
{a.ref}
</span>
 · {a.resp}
</span>
</span>
<span style={{ fontSize: "12.5px", color: a.dueC, textAlign: "end", lineHeight: "1.3" }}>
<span style={{ display: "block" }}>
{a.due}
</span>
<span style={{ display: "block" }}>
{a.dueSub}
</span>
</span>
<span style={{ height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", fontWeight: "500", color: a.st.fg, background: a.st.bg, display: "inline-flex", alignItems: "center" }}>
{a.st.label}
</span>
</Hover>
</Fragment>))}
</section>
</>) : null}
{pt.analytics ? (<>
<div style={{ background: "#fff", border: "1px dashed #D6D3CB", borderRadius: "6px", padding: "32px 20px", textAlign: "center", color: "#5C6168" }}>
<div style={{ fontWeight: "600", color: "#191C1F" }}>
{t.pt_analytics}
</div>
<div style={{ fontSize: "13px", marginTop: "4px", maxWidth: "520px", marginInline: "auto" }}>
{t.pa_desc}
</div>
<button onClick={pd.openAnalytics} style={{ marginTop: "12px", height: "40px", padding: "0 16px", border: "0", borderRadius: "4px", background: "#0F5C4A", color: "#fff", cursor: "pointer" }}>
{t.openAnalytics}
</button>
</div>
</>) : null}
</>) : null}
</div>
</>);
}
