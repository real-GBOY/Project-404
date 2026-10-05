/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import { Fragment } from "react";
import { Hover } from "@/components/Hover";
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";
import { FONT } from "@/styles/typography";

export function OverviewQuality({ vm }: { vm: VM }) {
  const { arr, explainOpen, goApproved, greeting, mainCols, notMobile, ov, pad, periodOpts, projCols, t, todayLong, toggleExplain } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "1360px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" }}>
<div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "12px 20px", flexWrap: "wrap" }}>
<div>
<div style={{ fontSize: "13px", color: C.text.secondary }}>
{todayLong}
</div>
<h1 style={{ margin: "2px 0 0", fontSize: "22px", fontWeight: "600" }}>
{greeting}
</h1>
</div>
<div style={{ display: "flex", border: `1px solid ${C.border.input}`, borderRadius: "4px", overflow: "hidden", background: C.surface.white }}>
{(periodOpts || []).map((o: any, __i: number) => (<Fragment key={__i}>
<button onClick={o.set} style={{ border: "0", height: "32px", padding: "0 12px", fontSize: "13px", cursor: "pointer", background: o.bg, color: o.fg }}>
{o.label}
</button>
</Fragment>))}
</div>
</div>
<div style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", overflow: "hidden" }}>
{(ov.attention || []).map((a: any, __i: number) => (<Fragment key={__i}>
<Hover as="button" onClick={a.go} style={{ textAlign: "start", background: C.surface.white, border: "0", borderInlineEnd: `1px solid ${C.surface.track}`, borderBottom: `1px solid ${C.surface.track}`, padding: "16px 18px", cursor: "pointer", display: "flex", flexDirection: "column", gap: "2px", marginBottom: "-1px" }} hover={{ background: C.surface.paper }}>
<span style={{ fontSize: "28px", fontWeight: "600", lineHeight: "1.15", fontVariantNumeric: "tabular-nums", color: a.color }}>
{a.n}
</span>
<span style={{ fontSize: "13.5px", fontWeight: "500" }}>
{a.label}
</span>
<span style={{ fontSize: "12px", color: C.text.muted }}>
{a.sub}
</span>
</Hover>
</Fragment>))}
</div>
<div style={{ display: "grid", gridTemplateColumns: mainCols, gap: "20px", alignItems: "start" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "20px", minWidth: "0" }}>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px" }}>
<div style={{ padding: "16px 18px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", borderBottom: `1px solid ${C.surface.track}` }}>
<button onClick={toggleExplain} style={{ background: "none", border: "0", padding: "0", textAlign: "start", cursor: "pointer" }}>
<div style={{ fontSize: "13px", color: C.text.secondary }}>
{t.overallCompliance}
</div>
<div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
<span style={{ fontSize: "34px", fontWeight: "600", fontVariantNumeric: "tabular-nums", lineHeight: "1.2" }}>
{ov.overallTxt}
</span>
<span style={{ fontSize: "13px", color: ov.deltaC }}>
{ov.deltaTxt}
</span>
</div>
<div style={{ fontSize: "12px", color: C.brand.primary }}>
{t.howCalculated}
</div>
</button>
<div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-end" }}>
<div style={{ display: "flex", alignItems: "flex-end", gap: "3px", height: "44px" }}>
{(ov.bars || []).map((b: any, __i: number) => (<Fragment key={__i}>
<div title={b.tip} style={{ width: "9px", height: b.h, background: b.c, borderRadius: "1px" }}></div>
</Fragment>))}
</div>
<span style={{ fontSize: "11px", color: C.text.muted }}>
{t.last12w}
</span>
</div>
</div>
{explainOpen ? (<>
<div style={{ padding: "12px 18px", background: C.surface.paper, borderBottom: `1px solid ${C.surface.track}`, fontSize: "13px", color: C.text.body, display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
<span style={{ flex: "1", minWidth: "240px" }}>
{ov.explain}
</span>
<button onClick={goApproved} style={{ background: "none", border: "0", color: C.brand.primary, fontSize: "13px", cursor: "pointer", padding: "0" }}>
{t.viewInspections} {arr}
</button>
</div>
</>) : null}
{notMobile ? (<>
<div style={{ display: "grid", gridTemplateColumns: projCols, gap: "12px", padding: "8px 18px", fontSize: "12px", color: C.text.muted, borderBottom: `1px solid ${C.surface.track}` }}>
<span>
{t.c_project}
</span>
<span>
{t.c_compliance}
</span>
<span>
{t.c_trend}
</span>
<span>
{t.c_openObs}
</span>
<span>
{t.c_overdueCA}
</span>
<span>
{t.c_nextVisit}
</span>
</div>
</>) : null}
{(ov.projects || []).map((p: any, __i: number) => (<Fragment key={__i}>
<Hover as="button" onClick={p.go} style={{ width: "100%", display: "grid", gridTemplateColumns: projCols, gap: "12px", alignItems: "center", padding: "12px 18px", border: "0", borderBottom: `1px solid ${C.surface.track}`, background: C.surface.white, textAlign: "start", cursor: "pointer", fontSize: "13.5px" }} hover={{ background: C.surface.paper }}>
<div style={{ minWidth: "0" }}>
<div style={{ fontWeight: "500", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{p.name}
</div>
<div style={{ fontSize: "12px", color: C.text.muted }}>
<span style={{ fontFamily: FONT.mono }}>
{p.code}
</span>
 · {p.city}
</div>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<div style={{ flex: "1", height: "6px", background: C.surface.track, borderRadius: "3px", overflow: "hidden" }}>
<div style={{ height: "100%", width: p.scoreW, background: p.scoreC }}></div>
</div>
<span style={{ fontWeight: "600", fontVariantNumeric: "tabular-nums", minWidth: "38px", color: p.scoreC }}>
{p.scoreTxt}
</span>
</div>
{notMobile ? (<>
<span style={{ color: p.deltaC, fontVariantNumeric: "tabular-nums" }}>
{p.delta}
</span>
<span style={{ fontVariantNumeric: "tabular-nums" }}>
{p.obs}
</span>
<span style={{ fontVariantNumeric: "tabular-nums", color: p.overdueC, fontWeight: "600" }}>
{p.overdue}
</span>
<span style={{ color: C.text.secondary }}>
{p.next}
</span>
</>) : null}
</Hover>
</Fragment>))}
</section>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px" }}>
<div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.surface.track}`, display: "flex", justifyContent: "space-between", gap: "12px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600" }}>
{t.visitStatus}
</h2>
<span style={{ fontSize: "12px", color: C.text.muted }}>
{ov.vTotal}
</span>
</div>
<div style={{ padding: "16px 18px" }}>
<div style={{ display: "flex", height: "10px", borderRadius: "2px", overflow: "hidden", gap: "2px" }}>
{(ov.vmix || []).map((m: any, __i: number) => (<Fragment key={__i}>
<div style={{ width: m.w, background: m.c }}></div>
</Fragment>))}
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: "2px 20px", marginTop: "12px" }}>
{(ov.vmix || []).map((m: any, __i: number) => (<Fragment key={__i}>
<button onClick={m.go} style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "0", padding: "7px 0", cursor: "pointer", fontSize: "13px", textAlign: "start", borderBottom: `1px solid ${C.surface.subtle}` }}>
<span style={{ width: "8px", height: "8px", borderRadius: "2px", background: m.c, flexShrink: "0" }}></span>
<span style={{ flex: "1" }}>
{m.label}
</span>
<span style={{ fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>
{m.n}
</span>
</button>
</Fragment>))}
</div>
</div>
</section>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "20px", minWidth: "0" }}>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px" }}>
<div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.surface.track}` }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600" }}>
{t.caPipeline}
</h2>
<div style={{ fontSize: "12px", color: C.text.muted }}>
{t.caPipelineSub}
</div>
</div>
<div style={{ padding: "8px 18px 14px" }}>
{(ov.caPipe || []).map((c: any, __i: number) => (<Fragment key={__i}>
<button onClick={c.go} style={{ width: "100%", display: "grid", gridTemplateColumns: "110px minmax(0,1fr) 28px", gap: "10px", alignItems: "center", background: "none", border: "0", padding: "8px 0", cursor: "pointer", textAlign: "start", fontSize: "13px" }}>
<span>
{c.label}
</span>
<span style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
<span style={{ height: "8px", background: C.surface.sunkenAlt, borderRadius: "2px", overflow: "hidden", display: "block" }}>
<span style={{ display: "block", height: "100%", width: c.w, background: c.c }}></span>
</span>
{c.hasOd ? (<>
<span style={{ fontSize: "11px", color: C.status.danger.fg }}>
{c.od}
</span>
</>) : null}
</span>
<span style={{ fontWeight: "600", fontVariantNumeric: "tabular-nums", textAlign: "end" }}>
{c.n}
</span>
</button>
</Fragment>))}
</div>
</section>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px" }}>
<div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.surface.track}` }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600" }}>
{t.repeatedIssues}
</h2>
<div style={{ fontSize: "12px", color: C.text.muted }}>
{t.repeatedSub}
</div>
</div>
{(ov.repeated || []).map((r: any, __i: number) => (<Fragment key={__i}>
<Hover as="button" onClick={r.go} style={{ width: "100%", display: "flex", gap: "12px", alignItems: "flex-start", padding: "12px 18px", border: "0", borderBottom: `1px solid ${C.surface.track}`, background: C.surface.white, cursor: "pointer", textAlign: "start" }} hover={{ background: C.surface.paper }}>
<span style={{ fontFamily: FONT.mono, fontWeight: "500", color: C.status.warning.fg, minWidth: "28px" }}>
{r.n}
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13.5px", fontWeight: "500" }}>
{r.t}
</span>
<span style={{ display: "block", fontSize: "12px", color: C.text.muted }}>
{r.proj}
</span>
</span>
<span style={{ height: "20px", padding: "0 7px", borderRadius: "3px", fontSize: "11.5px", color: r.sev.fg, background: r.sev.bg, whiteSpace: "nowrap" }}>
{r.sev.label}
</span>
</Hover>
</Fragment>))}
</section>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px" }}>
<div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.surface.track}` }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600" }}>
{t.workflowEvents}
</h2>
</div>
{(ov.events || []).map((e: any, __i: number) => (<Fragment key={__i}>
<Hover as="button" onClick={e.go} style={{ width: "100%", display: "block", padding: "10px 18px", border: "0", borderBottom: `1px solid ${C.surface.subtle}`, background: C.surface.white, cursor: "pointer", textAlign: "start", fontSize: "13px" }} hover={{ background: C.surface.paper }}>
<span style={{ fontWeight: "500" }}>
{e.who}
</span>
{' '}
<span style={{ color: C.text.body }}>
{e.act}
</span>
{' '}
<span style={{ fontFamily: FONT.mono, fontSize: "12px", color: C.brand.primary }}>
{e.ref}
</span>
<span style={{ display: "block", fontSize: "12px", color: C.text.muted }}>
{e.at}
</span>
</Hover>
</Fragment>))}
</section>
</div>
</div>
</div>
</>);
}
