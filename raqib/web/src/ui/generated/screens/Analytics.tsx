/* eslint-disable */
// GENERATED from the approved Claude Design (Raqib.dc.html) by tools/transpile — do not hand-edit.
import { Fragment } from "react";
import { Hover } from "@/ui/Hover";
import type { VM } from "@/ui/vm";

export function Analytics({ vm }: { vm: VM }) {
  const { an, arrBack, closeSheet, mobile, notMobile, pad, pageTitle, sheetOpen, t, toggleSheet } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "1360px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
{an.isFixed ? (<>
<button onClick={an.back} style={{ alignSelf: "flex-start", background: "none", border: "0", padding: "0", color: "#0F5C4A", fontSize: "13px", cursor: "pointer" }}>
{arrBack} {t.backProject}
</button>
</>) : null}
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "12px", flexWrap: "wrap" }}>
<div>
<h1 style={{ margin: "0", fontSize: "22px", fontWeight: "600" }}>
{pageTitle}
</h1>
<div style={{ fontSize: "13px", color: "#5C6168" }}>
{an.range} · {t.anSub}
</div>
</div>
<div style={{ display: "flex", gap: "8px" }}>
{mobile ? (<>
<button onClick={toggleSheet} style={{ height: "40px", padding: "0 14px", border: "1px solid #D6D3CB", borderRadius: "4px", background: "#fff", cursor: "pointer" }}>
{t.filters}
</button>
</>) : null}
{an.canExport ? (<>
<button onClick={an.exportCsv} style={{ height: "40px", padding: "0 14px", border: "1px solid #D6D3CB", borderRadius: "4px", background: "#fff", cursor: "pointer" }}>
{t.exportExcel}
</button>
</>) : null}
</div>
</div>
{notMobile ? (<>
<div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
<div style={{ display: "flex", border: "1px solid #D6D3CB", borderRadius: "4px", overflow: "hidden", background: "#fff" }}>
{(an.pers || []).map((o: any, __i: number) => (<Fragment key={__i}>
<button onClick={o.set} style={{ border: "0", height: "36px", padding: "0 12px", fontSize: "13px", cursor: "pointer", background: o.bg, color: o.fg }}>
{o.label}
</button>
</Fragment>))}
</div>
{an.isCustom ? (<>
<input type="date" value={an.from} onChange={an.onFrom} style={{ height: "36px", border: "1px solid #D6D3CB", borderRadius: "4px", padding: "0 8px" }} />
<input type="date" value={an.to} onChange={an.onTo} style={{ height: "36px", border: "1px solid #D6D3CB", borderRadius: "4px", padding: "0 8px" }} />
</>) : null}
{an.showProj ? (<>
<select value={an.p} onChange={an.onP} style={{ height: "36px", border: "1px solid #D6D3CB", borderRadius: "4px", padding: "0 10px", background: "#fff", fontSize: "13.5px" }}>
{(an.pOpts || []).map((o: any, __i: number) => (<Fragment key={__i}>
<option value={o.v}>
{o.l}
</option>
</Fragment>))}
</select>
</>) : null}
{an.showSite ? (<>
<select value={an.s} onChange={an.onS} style={{ height: "36px", border: "1px solid #D6D3CB", borderRadius: "4px", padding: "0 10px", background: "#fff", fontSize: "13.5px" }}>
{(an.sOpts || []).map((o: any, __i: number) => (<Fragment key={__i}>
<option value={o.v}>
{o.l}
</option>
</Fragment>))}
</select>
</>) : null}
</div>
</>) : null}
{sheetOpen ? (<>
<div onClick={closeSheet} style={{ position: "absolute", inset: "0", background: "rgba(18,26,24,.4)", zIndex: "30" }} aria-hidden="true"></div>
<div style={{ position: "absolute", insetInline: "0", bottom: "0", background: "#fff", borderRadius: "10px 10px 0 0", zIndex: "31", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
<div style={{ fontWeight: "600" }}>
{t.filters}
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "6px" }}>
{(an.pers || []).map((o: any, __i: number) => (<Fragment key={__i}>
<button onClick={o.set} style={{ height: "42px", border: "1px solid #D6D3CB", borderRadius: "4px", fontSize: "13px", background: o.bg, color: o.fg }}>
{o.label}
</button>
</Fragment>))}
</div>
{an.isCustom ? (<>
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
<input type="date" value={an.from} onChange={an.onFrom} style={{ height: "46px", border: "1px solid #D6D3CB", borderRadius: "4px", padding: "0 8px" }} />
<input type="date" value={an.to} onChange={an.onTo} style={{ height: "46px", border: "1px solid #D6D3CB", borderRadius: "4px", padding: "0 8px" }} />
</div>
</>) : null}
{an.showProj ? (<>
<select value={an.p} onChange={an.onP} style={{ height: "46px", border: "1px solid #D6D3CB", borderRadius: "4px", padding: "0 10px", background: "#fff", fontSize: "15px" }}>
{(an.pOpts || []).map((o: any, __i: number) => (<Fragment key={__i}>
<option value={o.v}>
{o.l}
</option>
</Fragment>))}
</select>
</>) : null}
{an.showSite ? (<>
<select value={an.s} onChange={an.onS} style={{ height: "46px", border: "1px solid #D6D3CB", borderRadius: "4px", padding: "0 10px", background: "#fff", fontSize: "15px" }}>
{(an.sOpts || []).map((o: any, __i: number) => (<Fragment key={__i}>
<option value={o.v}>
{o.l}
</option>
</Fragment>))}
</select>
</>) : null}
<button onClick={closeSheet} style={{ height: "46px", border: "0", borderRadius: "4px", background: "#0F5C4A", color: "#fff" }}>
{t.showResults}
</button>
</div>
</>) : null}
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: "8px" }}>
{(an.kpis || []).map((k: any, __i: number) => (<Fragment key={__i}>
<Hover as="button" onClick={k.go} style={{ textAlign: "start", background: "#fff", border: `1px solid ${k.bd}`, borderRadius: "6px", padding: "14px 16px", cursor: "pointer", display: "flex", flexDirection: "column", gap: "2px" }} hover={{ borderColor: "#0F5C4A" }}>
<span style={{ fontSize: "12.5px", color: "#5C6168" }}>
{k.label}
</span>
<span style={{ fontSize: "26px", fontWeight: "600", lineHeight: "1.2", color: k.c }}>
{k.val}
</span>
<span style={{ fontSize: "12px", color: "#8B9097" }}>
{k.sub}
</span>
</Hover>
</Fragment>))}
</div>
{an.hasDd ? (<>
<section style={{ background: "#fff", border: "1.5px solid #0F5C4A", borderRadius: "6px" }}>
<div style={{ padding: "14px 18px", borderBottom: "1px solid #EFEDE7", display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" }}>
<div>
<div style={{ fontSize: "12px", color: "#0F5C4A", fontWeight: "600" }}>
{t.howCalculatedTitle}
</div>
<h2 style={{ margin: "2px 0 0", fontSize: "16px", fontWeight: "600" }}>
{an.dd.title}
</h2>
</div>
<button onClick={an.dd.close} style={{ height: "34px", minWidth: "34px", border: "1px solid #D6D3CB", borderRadius: "4px", background: "#fff", cursor: "pointer" }}>
✕
</button>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: "0" }}>
<div style={{ padding: "12px 18px", borderBottom: "1px solid #F3F1EC" }}>
<div style={{ fontSize: "12px", color: "#8B9097" }}>
{t.definition}
</div>
<div style={{ fontSize: "13.5px" }}>
{an.dd.def}
</div>
</div>
<div style={{ padding: "12px 18px", borderBottom: "1px solid #F3F1EC" }}>
<div style={{ fontSize: "12px", color: "#8B9097" }}>
{t.formula}
</div>
<div style={{ fontSize: "13px", fontFamily: "'IBM Plex Mono',monospace" }}>
{an.dd.formula}
</div>
</div>
<div style={{ padding: "12px 18px", borderBottom: "1px solid #F3F1EC" }}>
<div style={{ fontSize: "12px", color: "#8B9097" }}>
{t.rp_period}
</div>
<div style={{ fontSize: "13.5px" }}>
{an.dd.period}
</div>
</div>
<div style={{ padding: "12px 18px", borderBottom: "1px solid #F3F1EC" }}>
<div style={{ fontSize: "12px", color: "#8B9097" }}>
{t.included}
</div>
<div style={{ fontSize: "13.5px" }}>
{an.dd.scope}
</div>
</div>
{an.dd.hasVers ? (<>
<div style={{ padding: "12px 18px", borderBottom: "1px solid #F3F1EC" }}>
<div style={{ fontSize: "12px", color: "#8B9097" }}>
{t.formVersions}
</div>
<div style={{ fontSize: "13px", fontFamily: "'IBM Plex Mono',monospace" }}>
{an.dd.vers}
</div>
</div>
</>) : null}
</div>
<div style={{ padding: "10px 18px", fontSize: "12px", color: "#8B9097" }}>
{t.contributing} · {an.dd.count}
</div>
<div style={{ maxHeight: "320px", overflowY: "auto" }}>
{(an.dd.list || []).map((r: any, __i: number) => (<Fragment key={__i}>
<button onClick={r.go} style={{ width: "100%", display: "flex", gap: "12px", alignItems: "center", padding: "9px 18px", border: "0", borderTop: "1px solid #F3F1EC", background: "#fff", cursor: "pointer", textAlign: "start" }}>
<span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "12.5px", minWidth: "100px", color: "#0F5C4A" }}>
{r.ref}
</span>
<span style={{ flex: "1", fontSize: "12.5px", color: "#5C6168", minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{r.sub}
</span>
<span style={{ fontWeight: "600", color: r.c, fontSize: "13px" }}>
{r.val}
</span>
</button>
</Fragment>))}
</div>
</section>
</>) : null}
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
<div style={{ padding: "14px 18px", borderBottom: "1px solid #EFEDE7", display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600" }}>
{t.complianceTrend}
</h2>
<span style={{ fontSize: "12px", color: "#8B9097" }}>
{t.trendHint}
</span>
</div>
<div style={{ padding: "14px 18px 10px", overflowX: "auto" }}>
<div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "160px", minWidth: "420px", borderBottom: "1px solid #E3E1DA" }}>
{(an.trend || []).map((b: any, __i: number) => (<Fragment key={__i}>
<button onClick={b.go} title={b.n} style={{ flex: "1", height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: "3px", border: "0", background: "none", cursor: "pointer", padding: "0" }}>
<span style={{ fontSize: "10.5px", color: "#3D4247" }}>
{b.v}
</span>
<span style={{ display: "block", width: "100%", maxWidth: "34px", height: b.h, background: b.c, borderRadius: "1px" }}></span>
</button>
</Fragment>))}
</div>
<div style={{ display: "flex", gap: "6px", minWidth: "420px", marginTop: "4px" }}>
{(an.trend || []).map((b: any, __i: number) => (<Fragment key={__i}>
<span style={{ flex: "1", textAlign: "center", fontSize: "10.5px", color: "#8B9097", whiteSpace: "nowrap" }}>
{b.l}
<span style={{ display: "block", color: "#5C6168" }}>
{b.n}
<span style={{ color: "#A3262A" }}>
{b.miss}
</span>
</span>
</span>
</Fragment>))}
</div>
</div>
</section>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,380px),1fr))", gap: "16px", alignItems: "start" }}>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 18px", borderBottom: "1px solid #EFEDE7" }}>
{t.ncBySection}
</h2>
<div style={{ padding: "10px 18px" }}>
{(an.secs || []).map((x: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 120px 32px", gap: "10px", alignItems: "center", padding: "6px 0", fontSize: "13px" }}>
<span>
{x.l}
</span>
<span style={{ height: "8px", background: "#F0EEE8", borderRadius: "2px", overflow: "hidden", display: "block" }}>
<span style={{ display: "block", height: "100%", width: x.w, background: "#A3262A" }}></span>
</span>
<span style={{ fontWeight: "600", textAlign: "end" }}>
{x.n}
</span>
</div>
</Fragment>))}
</div>
</section>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 18px", borderBottom: "1px solid #EFEDE7" }}>
{t.sitePerformance}
</h2>
<div style={{ padding: "6px 18px 10px", maxHeight: "300px", overflowY: "auto" }}>
{(an.siteRows || []).map((x: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 110px 46px", gap: "10px", alignItems: "center", padding: "6px 0", fontSize: "13px" }}>
<span>
<span style={{ display: "block" }}>
{x.l}
</span>
<span style={{ display: "block", fontSize: "11px", color: "#8B9097" }}>
{x.p} · {x.n} {t.inspWord}
</span>
</span>
<span style={{ height: "6px", background: "#EFEDE7", borderRadius: "3px", overflow: "hidden", display: "block" }}>
<span style={{ display: "block", height: "100%", width: x.w, background: x.c }}></span>
</span>
<span style={{ fontWeight: "600", color: x.c, textAlign: "end" }}>
{x.v}
</span>
</div>
</Fragment>))}
</div>
</section>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 18px", borderBottom: "1px solid #EFEDE7" }}>
{t.caStatus}
</h2>
<div style={{ padding: "10px 18px" }}>
{(an.caStages || []).map((x: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "grid", gridTemplateColumns: "120px minmax(0,1fr) 28px", gap: "10px", alignItems: "center", padding: "6px 0", fontSize: "13px" }}>
<span>
{x.l}
</span>
<span style={{ height: "8px", background: "#F0EEE8", borderRadius: "2px", overflow: "hidden", display: "block" }}>
<span style={{ display: "block", height: "100%", width: x.w, background: x.c }}></span>
</span>
<span style={{ fontWeight: "600", textAlign: "end" }}>
{x.n}
</span>
</div>
</Fragment>))}
</div>
</section>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 18px", borderBottom: "1px solid #EFEDE7" }}>
{t.guardDist}
</h2>
<div style={{ padding: "10px 18px" }}>
{(an.gb || []).map((x: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "grid", gridTemplateColumns: "110px minmax(0,1fr) 32px", gap: "10px", alignItems: "center", padding: "6px 0", fontSize: "13px" }}>
<span>
{x.l}
</span>
<span style={{ height: "8px", background: "#F0EEE8", borderRadius: "2px", overflow: "hidden", display: "block" }}>
<span style={{ display: "block", height: "100%", width: x.w, background: x.c }}></span>
</span>
<span style={{ fontWeight: "600", textAlign: "end" }}>
{x.n}
</span>
</div>
</Fragment>))}
</div>
</section>
{an.hasIns ? (<>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 18px", borderBottom: "1px solid #EFEDE7" }}>
{t.inspectorActivity}
</h2>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) repeat(4,minmax(0,1fr))", gap: "8px", padding: "8px 18px", fontSize: "11.5px", color: "#8B9097" }}>
<span>
{t.f_inspector}
</span>
<span>
{t.rp_done}
</span>
<span>
{t.missed}
</span>
<span>
{t.c_score}
</span>
<span>
{t.vs_returned}
</span>
</div>
{(an.insRows || []).map((x: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) repeat(4,minmax(0,1fr))", gap: "8px", padding: "9px 18px", borderTop: "1px solid #F3F1EC", fontSize: "13px" }}>
<span style={{ fontWeight: "500" }}>
{x.name}
</span>
<span>
{x.n}
</span>
<span>
{x.miss}
</span>
<span>
{x.avg}
</span>
<span>
{x.ret}
</span>
</div>
</Fragment>))}
</section>
</>) : null}
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 18px", borderBottom: "1px solid #EFEDE7" }}>
{t.repeatedIssues}
</h2>
{(an.rep || []).map((r: any, __i: number) => (<Fragment key={__i}>
<button onClick={r.go} style={{ width: "100%", display: "flex", gap: "12px", padding: "10px 18px", border: "0", borderBottom: "1px solid #F3F1EC", background: "#fff", cursor: "pointer", textAlign: "start" }}>
<span style={{ fontFamily: "'IBM Plex Mono',monospace", color: "#8A5A00", minWidth: "28px" }}>
{r.n}
</span>
<span>
<span style={{ display: "block", fontSize: "13px", fontWeight: "500" }}>
{r.t}
</span>
<span style={{ display: "block", fontSize: "12px", color: "#8B9097" }}>
{r.sub}
</span>
</span>
</button>
</Fragment>))}
</section>
</div>
</div>
</>);
}
