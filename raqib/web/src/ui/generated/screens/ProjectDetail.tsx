/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import { Fragment } from "react";
import { Hover } from "@/components/Hover";
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";
import { FONT } from "@/styles/typography";

export function ProjectDetail({ vm }: { vm: VM }) {
  const { arrBack, mainCols, pad, pd, pt, t } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "1360px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
<button onClick={pd.back} style={{ alignSelf: "flex-start", background: "none", border: "0", padding: "0", color: C.brand.primary, fontSize: "13px", cursor: "pointer" }}>
{arrBack} {t.nav_projects_l}
</button>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "12px 20px", flexWrap: "wrap" }}>
<div>
<div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
<span style={{ fontFamily: FONT.mono, fontSize: "12.5px", color: C.text.secondary }}>
{pd.code}
</span>
<span style={{ display: "inline-flex", alignItems: "center", height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", fontWeight: "500", color: pd.st.fg, background: pd.st.bg }}>
{pd.st.label}
</span>
</div>
<h1 style={{ margin: "2px 0 4px", fontSize: "24px", fontWeight: "600" }}>
{pd.name}
</h1>
<div style={{ fontSize: "13px", color: C.text.secondary, display: "flex", gap: "6px 16px", flexWrap: "wrap" }}>
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
<div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
{pd.canEdit ? (<>
<button onClick={pd.edit} style={{ height: "40px", padding: "0 12px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, color: C.text.ink, fontSize: "13px", cursor: "pointer" }}>
{t.pa_editProject}
</button>
</>) : null}
{pd.canSchedule ? (<>
<button onClick={pd.schedule} style={{ height: "40px", padding: "0 16px", border: "0", borderRadius: "4px", background: C.brand.primary, color: C.surface.white, fontWeight: "500", cursor: "pointer" }}>
{t.scheduleVisit}
</button>
</>) : null}
</div>
</div>
<div style={{ display: "flex", gap: "4px", borderBottom: `1px solid ${C.border.hairline}`, overflowX: "auto" }}>
{(pd.tabs || []).map((tb: any, __i: number) => (<Fragment key={__i}>
<button onClick={tb.go} style={{ height: "42px", padding: "0 14px", border: "0", borderBottom: `2px solid ${tb.bd}`, background: "none", color: tb.fg, fontWeight: tb.fw, fontSize: "13.5px", cursor: "pointer", whiteSpace: "nowrap", marginBottom: "-1px" }}>
{tb.label}
</button>
</Fragment>))}
</div>
{pd.empty ? (<>
<div style={{ background: C.surface.white, border: `1px dashed ${C.border.input}`, borderRadius: "6px", padding: "40px 20px", textAlign: "center" }}>
<div style={{ fontWeight: "600" }}>
{t.projEmptyTitle}
</div>
<div style={{ fontSize: "13px", color: C.text.secondary, marginTop: "4px" }}>
{pd.emptyTxt}
</div>
</div>
</>) : null}
{pd.notEmpty ? (<>
{pt.overview ? (<>
<div style={{ display: "grid", gridTemplateColumns: mainCols, gap: "20px", alignItems: "start" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "20px", minWidth: "0" }}>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px", padding: "18px", display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-end" }}>
<div style={{ minWidth: "160px" }}>
<div style={{ fontSize: "13px", color: C.text.secondary }}>
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
<div style={{ fontSize: "12px", color: C.text.secondary, marginTop: "10px" }}>
{pd.completion}
</div>
<div style={{ height: "4px", background: C.surface.track, borderRadius: "2px", overflow: "hidden", marginTop: "4px", width: "160px" }}>
<div style={{ height: "100%", width: pd.compW, background: C.brand.primary }}></div>
</div>
</div>
<div style={{ flex: "1", minWidth: "260px" }}>
<div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "110px", borderBottom: `1px solid ${C.border.hairline}` }}>
{(pd.weeks || []).map((w: any, __i: number) => (<Fragment key={__i}>
<div style={{ flex: "1", height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: "3px" }}>
<span style={{ fontSize: "10px", color: C.text.muted }}>
{w.v}
</span>
<div style={{ width: "100%", maxWidth: "22px", height: w.h, background: w.c, borderRadius: "1px" }}></div>
</div>
</Fragment>))}
</div>
<div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
{(pd.weeks || []).map((w: any, __i: number) => (<Fragment key={__i}>
<span style={{ flex: "1", fontSize: "10.5px", color: C.text.muted, textAlign: "center", whiteSpace: "nowrap" }}>
{w.lbl}
</span>
</Fragment>))}
</div>
</div>
</section>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 18px", borderBottom: `1px solid ${C.surface.track}` }}>
{t.sitePerformance}
</h2>
{(pd.siteRows || []).map((x: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(120px,200px)", gap: "16px", alignItems: "center", padding: "11px 18px", borderBottom: `1px solid ${C.surface.subtle}` }}>
<div style={{ minWidth: "0" }}>
<div style={{ fontWeight: "500" }}>
{x.n}
</div>
<div style={{ fontSize: "12px", color: C.text.muted }}>
{x.areas}
</div>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<div style={{ flex: "1", height: "6px", background: C.surface.track, borderRadius: "3px", overflow: "hidden" }}>
<div style={{ height: "100%", width: x.scoreW, background: x.scoreC }}></div>
</div>
<span style={{ fontWeight: "600", color: x.scoreC, minWidth: "36px" }}>
{x.scoreTxt}
</span>
</div>
</div>
</Fragment>))}
</section>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 18px", borderBottom: `1px solid ${C.surface.track}` }}>
{t.recentInspections}
</h2>
{(pd.recent || []).map((v: any, __i: number) => (<Fragment key={__i}>
<Hover as="button" onClick={v.go} style={{ width: "100%", display: "flex", gap: "12px", alignItems: "center", padding: "11px 18px", border: "0", borderBottom: `1px solid ${C.surface.subtle}`, background: C.surface.white, cursor: "pointer", textAlign: "start", flexWrap: "wrap" }} hover={{ background: C.surface.paper }}>
<span style={{ flex: "1", minWidth: "200px" }}>
<span style={{ display: "block", fontWeight: "500" }}>
{v.site} — {v.area}
</span>
<span style={{ display: "block", fontSize: "12px", color: C.text.muted }}>
<span style={{ fontFamily: FONT.mono }}>
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
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 18px", borderBottom: `1px solid ${C.surface.track}` }}>
{t.needsAttention}
</h2>
{(pd.attn || []).map((a: any, __i: number) => (<Fragment key={__i}>
<Hover as="button" onClick={a.go} style={{ width: "100%", display: "flex", gap: "10px", padding: "12px 18px", border: "0", borderBottom: `1px solid ${C.surface.subtle}`, background: C.surface.white, cursor: "pointer", textAlign: "start" }} hover={{ background: C.surface.paper }}>
<span style={{ width: "8px", height: "8px", borderRadius: "50%", background: a.c, marginTop: "6px", flexShrink: "0" }}></span>
<span>
<span style={{ display: "block", fontWeight: "500", fontSize: "13.5px" }}>
{a.t}
</span>
<span style={{ display: "block", fontSize: "12.5px", color: C.text.secondary }}>
{a.sub}
</span>
</span>
</Hover>
</Fragment>))}
{pd.noAttn ? (<>
<div style={{ padding: "16px 18px", fontSize: "13px", color: C.text.secondary }}>
{t.nothingAttention}
</div>
</>) : null}
</section>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 18px", borderBottom: `1px solid ${C.surface.track}` }}>
{t.openCAs}
</h2>
{(pd.openCas || []).map((a: any, __i: number) => (<Fragment key={__i}>
<Hover as="button" onClick={a.go} style={{ width: "100%", display: "flex", gap: "10px", alignItems: "flex-start", padding: "12px 18px", border: "0", borderBottom: `1px solid ${C.surface.subtle}`, background: C.surface.white, cursor: "pointer", textAlign: "start" }} hover={{ background: C.surface.paper }}>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13.5px", fontWeight: "500" }}>
{a.t}
</span>
<span style={{ display: "block", fontSize: "12px", color: C.text.muted }}>
<span style={{ fontFamily: FONT.mono }}>
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
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px" }}>
{pd.canEdit ? (<>
<div style={{ display: "flex", justifyContent: "flex-end", padding: "10px 18px", borderBottom: `1px solid ${C.surface.subtle}` }}>
<button onClick={pd.addSite} style={{ height: "34px", padding: "0 12px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, color: C.text.ink, fontSize: "13px", cursor: "pointer" }}>
{t.pa_addSite}
</button>
</div>
</>) : null}
{pd.noSites ? (<>
<div style={{ padding: "28px 18px", textAlign: "center", fontSize: "13.5px", color: C.text.secondary }}>
{t.pa_noSites}
</div>
</>) : null}
{(pd.siteRows || []).map((x: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "flex", gap: "16px", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${C.surface.subtle}`, flexWrap: "wrap" }}>
<div style={{ flex: "1", minWidth: "200px" }}>
<div style={{ fontWeight: "600" }}>
{x.n}
</div>
<div style={{ fontSize: "12.5px", color: C.text.secondary, display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center", marginTop: "4px" }}>
<span>
{t.areas}:
</span>
{(x.areaChips || []).length === 0 ? (<>
<span>
—
</span>
</>) : null}
{(x.areaChips || []).map((a: any, __j: number) => (<Fragment key={__j}>
<span style={{ display: "inline-flex", alignItems: "center", gap: "4px", border: `1px solid ${C.border.hairline}`, borderRadius: "12px", padding: "1px 4px 1px 10px", background: C.surface.paper }}>
{a.n}
{pd.canEdit ? (<>
<button onClick={a.archive} aria-label={t.pa_archive} title={t.pa_archive} style={{ border: "0", background: "none", cursor: "pointer", color: C.text.muted, fontSize: "14px", lineHeight: "1", padding: "2px 4px" }}>
×
</button>
</>) : null}
</span>
</Fragment>))}
</div>
</div>
<span style={{ fontSize: "12.5px", color: C.text.secondary }}>
{t.k_visits} {x.vis} · {t.c_openObs} {x.obs}
</span>
<span style={{ fontWeight: "600", color: x.scoreC, minWidth: "44px", textAlign: "end" }}>
{x.scoreTxt}
</span>
{pd.canEdit ? (<>
<span style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
<button onClick={x.addArea} style={{ height: "34px", padding: "0 12px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, color: C.text.ink, fontSize: "13px", cursor: "pointer" }}>
{t.pa_addArea}
</button>
<button onClick={x.rename} style={{ height: "34px", padding: "0 12px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, color: C.text.ink, fontSize: "13px", cursor: "pointer" }}>
{t.pa_rename}
</button>
<button onClick={x.archive} style={{ height: "34px", padding: "0 12px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, color: C.status.danger.fg, fontSize: "13px", cursor: "pointer" }}>
{t.pa_archive}
</button>
</span>
</>) : null}
</div>
</Fragment>))}
</section>
</>) : null}
{pt.visits ? (<>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px" }}>
{(pd.visits || []).map((v: any, __i: number) => (<Fragment key={__i}>
<Hover as="button" onClick={v.go} style={{ width: "100%", display: "flex", gap: "12px", alignItems: "center", padding: "11px 18px", border: "0", borderBottom: `1px solid ${C.surface.subtle}`, background: C.surface.white, cursor: "pointer", textAlign: "start", flexWrap: "wrap" }} hover={{ background: C.surface.paper }}>
<span style={{ fontFamily: FONT.mono, fontSize: "12.5px", minWidth: "100px" }}>
{v.ref}
</span>
<span style={{ flex: "1", minWidth: "180px" }}>
<span style={{ display: "block", fontWeight: "500" }}>
{v.site} — {v.area}
</span>
<span style={{ display: "block", fontSize: "12px", color: C.text.muted }}>
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
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px" }}>
{(pd.obs || []).map((o: any, __i: number) => (<Fragment key={__i}>
<Hover as="button" onClick={o.go} style={{ width: "100%", display: "flex", gap: "12px", alignItems: "center", padding: "12px 18px", border: "0", borderBottom: `1px solid ${C.surface.subtle}`, background: C.surface.white, cursor: "pointer", textAlign: "start", flexWrap: "wrap" }} hover={{ background: C.surface.paper }}>
<span style={{ flex: "1", minWidth: "220px" }}>
<span style={{ display: "block", fontWeight: "500" }}>
{o.t}
</span>
<span style={{ display: "block", fontSize: "12px", color: C.text.muted }}>
<span style={{ fontFamily: FONT.mono }}>
{o.ref}
</span>
 · {o.site} · {o.visit}
</span>
</span>
{o.hasRep ? (<>
<span style={{ fontFamily: FONT.mono, color: C.status.warning.fg, fontWeight: "500" }}>
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
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px" }}>
{(pd.cas || []).map((a: any, __i: number) => (<Fragment key={__i}>
<Hover as="button" onClick={a.go} style={{ width: "100%", display: "flex", gap: "12px", alignItems: "center", padding: "12px 18px", border: "0", borderBottom: `1px solid ${C.surface.subtle}`, background: C.surface.white, cursor: "pointer", textAlign: "start", flexWrap: "wrap" }} hover={{ background: C.surface.paper }}>
<span style={{ flex: "1", minWidth: "220px" }}>
<span style={{ display: "block", fontWeight: "500" }}>
{a.t}
</span>
<span style={{ display: "block", fontSize: "12px", color: C.text.muted }}>
<span style={{ fontFamily: FONT.mono }}>
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
<div style={{ background: C.surface.white, border: `1px dashed ${C.border.input}`, borderRadius: "6px", padding: "32px 20px", textAlign: "center", color: C.text.secondary }}>
<div style={{ fontWeight: "600", color: C.text.ink }}>
{t.pt_analytics}
</div>
<div style={{ fontSize: "13px", marginTop: "4px", maxWidth: "520px", marginInline: "auto" }}>
{t.pa_desc}
</div>
<button onClick={pd.openAnalytics} style={{ marginTop: "12px", height: "40px", padding: "0 16px", border: "0", borderRadius: "4px", background: C.brand.primary, color: C.surface.white, cursor: "pointer" }}>
{t.openAnalytics}
</button>
</div>
</>) : null}
</>) : null}
</div>
</>);
}
