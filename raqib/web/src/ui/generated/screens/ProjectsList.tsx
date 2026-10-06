/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import { Fragment } from "react";
import { Hover } from "@/components/Hover";
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";
import { FONT } from "@/styles/typography";

export function ProjectsList({ vm }: { vm: VM }) {
  const { mobile, notMobile, pad, pl, pstatusOpts, t } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "1360px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
<div style={{ display: "flex", gap: "12px", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
<div>
<h1 style={{ margin: "0", fontSize: "22px", fontWeight: "600" }}>
{t.nav_projects_l}
</h1>
<div style={{ fontSize: "13px", color: C.text.secondary }}>
{pl.count}
</div>
</div>
{pl.canCreate ? (<>
<button onClick={pl.create} style={{ height: "40px", padding: "0 16px", border: "0", borderRadius: "4px", background: C.brand.primary, color: C.surface.white, fontWeight: "500", cursor: "pointer" }}>
{t.pa_newProject}
</button>
</>) : null}
</div>
<div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
<input value={pl.q} onChange={pl.onQ} placeholder={t.projSearchPh} style={{ height: "38px", flex: "1", minWidth: "220px", maxWidth: "380px", border: `1px solid ${C.border.input}`, borderRadius: "4px", padding: "0 12px", fontSize: "14px", background: C.surface.white }} />
<div style={{ display: "flex", border: `1px solid ${C.border.input}`, borderRadius: "4px", overflow: "hidden", background: C.surface.white, flexWrap: "wrap" }}>
{(pstatusOpts || []).map((o: any, __i: number) => (<Fragment key={__i}>
<button onClick={o.set} style={{ border: "0", height: "36px", padding: "0 12px", fontSize: "13px", cursor: "pointer", background: o.bg, color: o.fg }}>
{o.label}
</button>
</Fragment>))}
</div>
</div>
{pl.has ? (<>
{notMobile ? (<>
<div style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px", overflowX: "auto" }}>
<table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13.5px", minWidth: "980px" }}>
<thead>
<tr style={{ background: C.surface.paper }}>
<th style={{ textAlign: "start", fontWeight: "500", fontSize: "12px", color: C.text.secondary, padding: "10px 14px", borderBottom: `1px solid ${C.border.hairline}` }}>
{t.c_project}
</th>
<th style={{ textAlign: "start", fontWeight: "500", fontSize: "12px", color: C.text.secondary, padding: "10px 14px", borderBottom: `1px solid ${C.border.hairline}` }}>
{t.c_st}
</th>
<th style={{ textAlign: "start", fontWeight: "500", fontSize: "12px", color: C.text.secondary, padding: "10px 14px", borderBottom: `1px solid ${C.border.hairline}` }}>
{t.c_manager}
</th>
<th style={{ textAlign: "start", fontWeight: "500", fontSize: "12px", color: C.text.secondary, padding: "10px 14px", borderBottom: `1px solid ${C.border.hairline}` }}>
{t.c_sites}
</th>
<th style={{ textAlign: "start", fontWeight: "500", fontSize: "12px", color: C.text.secondary, padding: "10px 14px", borderBottom: `1px solid ${C.border.hairline}`, minWidth: "150px" }}>
{t.c_compliance}
</th>
<th style={{ textAlign: "start", fontWeight: "500", fontSize: "12px", color: C.text.secondary, padding: "10px 14px", borderBottom: `1px solid ${C.border.hairline}` }}>
{t.c_openObs}
</th>
<th style={{ textAlign: "start", fontWeight: "500", fontSize: "12px", color: C.text.secondary, padding: "10px 14px", borderBottom: `1px solid ${C.border.hairline}` }}>
{t.c_openCA}
</th>
<th style={{ textAlign: "start", fontWeight: "500", fontSize: "12px", color: C.text.secondary, padding: "10px 14px", borderBottom: `1px solid ${C.border.hairline}` }}>
{t.c_overdue}
</th>
<th style={{ textAlign: "start", fontWeight: "500", fontSize: "12px", color: C.text.secondary, padding: "10px 14px", borderBottom: `1px solid ${C.border.hairline}` }}>
{t.c_lastInsp}
</th>
<th style={{ textAlign: "start", fontWeight: "500", fontSize: "12px", color: C.text.secondary, padding: "10px 14px", borderBottom: `1px solid ${C.border.hairline}` }}>
{t.c_nextVisit}
</th>
</tr>
</thead>
<tbody>
{(pl.rows || []).map((p: any, __i: number) => (<Fragment key={__i}>
<Hover as="tr" onClick={p.go} style={{ cursor: "pointer" }} hover={{ background: C.surface.paper }}>
<td style={{ padding: "12px 14px", borderBottom: `1px solid ${C.surface.track}` }}>
<div style={{ fontWeight: "500" }}>
{p.name}
</div>
<div style={{ fontSize: "12px", color: C.text.muted }}>
<span style={{ fontFamily: FONT.mono }}>
{p.code}
</span>
 · {p.city}
</div>
</td>
<td style={{ padding: "12px 14px", borderBottom: `1px solid ${C.surface.track}` }}>
<span style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", fontWeight: "500", whiteSpace: "nowrap", color: p.st.fg, background: p.st.bg }}>
{p.st.label}
</span>
</td>
<td style={{ padding: "12px 14px", borderBottom: `1px solid ${C.surface.track}` }}>
{p.mgr}
</td>
<td style={{ padding: "12px 14px", borderBottom: `1px solid ${C.surface.track}`, fontVariantNumeric: "tabular-nums" }}>
{p.sites}
</td>
<td style={{ padding: "12px 14px", borderBottom: `1px solid ${C.surface.track}` }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<div style={{ flex: "1", height: "6px", background: C.surface.track, borderRadius: "3px", overflow: "hidden" }}>
<div style={{ height: "100%", width: p.scoreW, background: p.scoreC }}></div>
</div>
<span style={{ fontWeight: "600", color: p.scoreC, minWidth: "36px" }}>
{p.scoreTxt}
</span>
</div>
</td>
<td style={{ padding: "12px 14px", borderBottom: `1px solid ${C.surface.track}`, fontVariantNumeric: "tabular-nums" }}>
{p.obs}
</td>
<td style={{ padding: "12px 14px", borderBottom: `1px solid ${C.surface.track}`, fontVariantNumeric: "tabular-nums" }}>
{p.ca}
</td>
<td style={{ padding: "12px 14px", borderBottom: `1px solid ${C.surface.track}`, fontWeight: "600", color: p.odC }}>
{p.od}
</td>
<td style={{ padding: "12px 14px", borderBottom: `1px solid ${C.surface.track}`, color: C.text.secondary }}>
{p.last}
</td>
<td style={{ padding: "12px 14px", borderBottom: `1px solid ${C.surface.track}`, color: C.text.secondary }}>
{p.next}
</td>
</Hover>
</Fragment>))}
</tbody>
</table>
</div>
</>) : null}
{mobile ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
{(pl.rows || []).map((p: any, __i: number) => (<Fragment key={__i}>
<button onClick={p.go} style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "14px", border: `1px solid ${C.border.hairline}`, borderRadius: "6px", background: C.surface.white, cursor: "pointer", textAlign: "start" }}>
<span style={{ display: "flex", justifyContent: "space-between", gap: "10px", width: "100%" }}>
<span>
<span style={{ display: "block", fontWeight: "600" }}>
{p.name}
</span>
<span style={{ display: "block", fontSize: "12px", color: C.text.muted, fontFamily: FONT.mono }}>
{p.code}
</span>
</span>
<span style={{ height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", color: p.st.fg, background: p.st.bg, whiteSpace: "nowrap" }}>
{p.st.label}
</span>
</span>
<span style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%" }}>
<span style={{ flex: "1", height: "6px", background: C.surface.track, borderRadius: "3px", overflow: "hidden", display: "block" }}>
<span style={{ display: "block", height: "100%", width: p.scoreW, background: p.scoreC }}></span>
</span>
<span style={{ fontWeight: "600", color: p.scoreC }}>
{p.scoreTxt}
</span>
</span>
<span style={{ fontSize: "12.5px", color: C.text.secondary }}>
{t.c_openObs} {p.obs} · {t.c_openCA} {p.ca} · 
<span style={{ color: p.odC }}>
{t.c_overdue} {p.od}
</span>
</span>
</button>
</Fragment>))}
</div>
</>) : null}
</>) : null}
{pl.none ? (<>
<div style={{ background: C.surface.white, border: `1px dashed ${C.border.input}`, borderRadius: "6px", padding: "40px 20px", textAlign: "center" }}>
<div style={{ fontWeight: "600" }}>
{t.noResults}
</div>
<div style={{ fontSize: "13px", color: C.text.secondary, margin: "4px 0 12px" }}>
{t.noResultsSub}
</div>
<button onClick={pl.clear} style={{ height: "36px", padding: "0 14px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, cursor: "pointer" }}>
{t.clearFilters}
</button>
</div>
</>) : null}
</div>
</>);
}
