/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import { Fragment } from "react";
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";
import { FONT } from "@/styles/typography";

export function InspectionReport({ vm }: { vm: VM }) {
  const { arrBack, hpad, rp, t } = vm;
  return (<>
<div style={{ minHeight: "100%", background: C.border.soft, display: "flex", flexDirection: "column" }}>
<div style={{ position: "sticky", top: "0", zIndex: "4", background: C.surface.white, borderBottom: `1px solid ${C.border.hairline}`, display: "flex", alignItems: "center", gap: "10px", padding: `10px ${hpad}`, flexWrap: "wrap" }}>
<button onClick={rp.back} style={{ height: "38px", padding: "0 12px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, cursor: "pointer" }}>
{arrBack} {t.back}
</button>
<span style={{ fontFamily: FONT.mono, fontSize: "13px", flex: "1", minWidth: "120px" }}>
{rp.ref}
</span>
<span style={{ fontSize: "12.5px", color: C.text.secondary }}>
{t.reportLang}
</span>
<div style={{ display: "flex", border: `1px solid ${C.border.input}`, borderRadius: "4px", overflow: "hidden" }}>
{(rp.langs || []).map((o: any, __i: number) => (<Fragment key={__i}>
<button onClick={o.set} style={{ border: "0", height: "34px", padding: "0 12px", fontSize: "13px", cursor: "pointer", background: o.bg, color: o.fg }}>
{o.label}
</button>
</Fragment>))}
</div>
<button onClick={rp.excel} style={{ height: "38px", padding: "0 14px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, cursor: "pointer" }}>
{t.exportExcel}
</button>
<button onClick={rp.download} style={{ height: "38px", padding: "0 16px", border: "0", borderRadius: "4px", background: C.brand.primary, color: C.surface.white, fontWeight: "500", cursor: "pointer" }}>
{t.downloadPdf}
</button>
</div>
<div style={{ padding: "24px 12px 48px", display: "flex", justifyContent: "center" }}>
<article data-print-root="1" data-print-title={rp.printTitle} dir={rp.dir} style={{ width: "100%", maxWidth: "794px", background: C.surface.white, boxShadow: `0 1px 3px ${C.shadow.soft},0 8px 24px ${C.shadow.hairline}`, padding: "44px 48px", display: "flex", flexDirection: "column", gap: "22px", fontSize: "12.5px", lineHeight: "1.5", color: C.text.ink }}>
<header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px", borderBottom: `2px solid ${C.text.ink}`, paddingBottom: "16px" }}>
<div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
<div style={{ width: "34px", height: "34px", background: C.brand.primary, borderRadius: "4px", color: C.surface.white, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700" }}>
ر
</div>
<div style={{ lineHeight: "1.25" }}>
<div style={{ fontWeight: "700", fontSize: "15px" }}>
رقيب · Raqib
</div>
<div style={{ fontSize: "11px", color: C.text.secondary }}>
{rp.dept}
</div>
</div>
</div>
<div style={{ width: "120px", height: "44px", border: `1px dashed ${C.border.strong}`, background: `repeating-linear-gradient(135deg,${C.surface.paperAlt} 0 6px,${C.surface.track} 6px 12px)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT.mono, fontSize: "10px", color: C.text.secondary }}>
{rp.labels.logo}
</div>
</header>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
<div>
<div style={{ fontSize: "20px", fontWeight: "700" }}>
{rp.title}
</div>
<div style={{ fontFamily: FONT.mono, fontSize: "12px", color: C.text.secondary }}>
{rp.ref}
</div>
</div>
<div style={{ border: `2px solid ${rp.statusC}`, color: rp.statusC, padding: "4px 12px", fontWeight: "700", fontSize: "13px", borderRadius: "2px" }}>
{rp.status}
</div>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", border: `1px solid ${C.border.input}` }}>
{(rp.meta || []).map((m: any, __i: number) => (<Fragment key={__i}>
<div style={{ padding: "7px 10px", borderBottom: `1px solid ${C.border.hairline}`, borderInlineEnd: `1px solid ${C.border.hairline}` }}>
<div style={{ fontSize: "10.5px", color: C.text.secondary }}>
{m.k}
</div>
<div style={{ fontWeight: "500" }}>
{m.v}
</div>
</div>
</Fragment>))}
</div>
<div style={{ fontSize: "11px", color: C.text.secondary, border: `1px solid ${C.border.hairline}`, padding: "6px 10px", display: "flex", gap: "16px", flexWrap: "wrap" }}>
<span>
{rp.shiftLabel}: {rp.shift}
</span>
<span>
{rp.versionNote}
</span>
</div>
<div style={{ display: "flex", gap: "24px", alignItems: "center", background: C.surface.paperAlt, padding: "14px 16px" }}>
<div style={{ fontSize: "36px", fontWeight: "700", color: rp.scoreC, lineHeight: "1" }}>
{rp.score}
</div>
<div>
<div style={{ fontWeight: "600", fontSize: "14px" }}>
{rp.labels.summary} — {rp.rating}
</div>
<div style={{ color: C.text.body }}>
{rp.counts}
</div>
</div>
</div>
<table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11.5px" }}>
<thead>
<tr style={{ background: C.text.ink, color: C.surface.white }}>
<th style={{ textAlign: "start", padding: "6px 8px", fontWeight: "500", width: "36px" }}>
#
</th>
<th style={{ textAlign: "start", padding: "6px 8px", fontWeight: "500" }}>
{rp.labels.item}
</th>
<th style={{ textAlign: "center", padding: "6px 8px", fontWeight: "500", width: "44px" }}>
{rp.labels.w}
</th>
<th style={{ textAlign: "start", padding: "6px 8px", fontWeight: "500", width: "82px" }}>
{rp.labels.res}
</th>
<th style={{ textAlign: "center", padding: "6px 8px", fontWeight: "500", width: "44px" }}>
{rp.labels.pts}
</th>
<th style={{ textAlign: "start", padding: "6px 8px", fontWeight: "500", width: "30%" }}>
{rp.labels.notes}
</th>
</tr>
</thead>
<tbody>
{(rp.rows || []).map((r: any, __i: number) => (<Fragment key={__i}>
{r.isSec ? (<>
<tr>
<td colSpan={6} style={{ padding: "7px 8px", background: C.surface.sunken, fontWeight: "600" }}>
{r.label}
</td>
</tr>
</>) : null}
{r.isQ ? (<>
<tr>
<td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border.hairline}`, fontFamily: FONT.mono }}>
{r.num}
</td>
<td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border.hairline}` }}>
{r.text}
</td>
<td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border.hairline}`, textAlign: "center" }}>
{r.w}
</td>
<td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border.hairline}`, color: r.resC, fontWeight: "600" }}>
{r.res}
</td>
<td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border.hairline}`, textAlign: "center" }}>
{r.pts}
</td>
<td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border.hairline}`, color: C.text.body }}>
{r.note}
</td>
</tr>
</>) : null}
</Fragment>))}
</tbody>
</table>
{rp.hasViol ? (<>
<section>
<h3 style={{ margin: "0 0 6px", fontSize: "13.5px", borderBottom: `1px solid ${C.text.ink}`, paddingBottom: "4px" }}>
{rp.labels.viol}
</h3>
{(rp.viol || []).map((x: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "flex", gap: "10px", padding: "5px 0", borderBottom: `1px solid ${C.surface.track}` }}>
<span style={{ fontFamily: FONT.mono, minWidth: "32px" }}>
{x.num}
</span>
<span style={{ flex: "1" }}>
<span style={{ fontWeight: "600" }}>
{x.text}
</span>
 — {x.note}
</span>
<span style={{ color: C.status.danger.fg, fontWeight: "600" }}>
{x.sev}
</span>
</div>
</Fragment>))}
</section>
</>) : null}
{rp.hasEvid ? (<>
<section>
<h3 style={{ margin: "0 0 8px", fontSize: "13.5px", borderBottom: `1px solid ${C.text.ink}`, paddingBottom: "4px" }}>
{rp.labels.ev}
</h3>
<div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: "8px" }}>
{(rp.evid || []).map((e: any, __i: number) => (<Fragment key={__i}>
<div>
<div style={{ height: "72px", position: "relative", overflow: "hidden", background: `repeating-linear-gradient(135deg,${C.surface.sunkenAlt} 0 6px,${C.surface.sunkenDeep} 6px 12px)`, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${C.border.hairline}` }}>
{e.hasUrl ? (<>
<div style={{ position: "absolute", inset: "0", backgroundPosition: "center", backgroundSize: "cover", backgroundRepeat: "no-repeat", backgroundImage: e.bgImg }}></div>
</>) : null}
<span style={{ position: "relative", fontFamily: FONT.mono, fontSize: "9.5px", background: C.glass, padding: "1px 4px" }}>
{e.kind}
</span>
</div>
<div style={{ fontSize: "10px", color: C.text.secondary, marginTop: "2px", fontFamily: FONT.mono }}>
{e.ref}
</div>
<div dir="ltr" style={{ fontSize: "10px", color: C.text.body, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "start" }}>
{e.cap}
</div>
</div>
</Fragment>))}
</div>
</section>
</>) : null}
<section>
<h3 style={{ margin: "0 0 6px", fontSize: "13.5px", borderBottom: `1px solid ${C.text.ink}`, paddingBottom: "4px" }}>
{rp.labels.ca}
</h3>
{rp.hasCas ? (<>
<table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11.5px" }}>
<thead>
<tr>
<th style={{ textAlign: "start", padding: "5px 6px", borderBottom: `1px solid ${C.border.input}`, fontWeight: "600" }}>
#
</th>
<th style={{ textAlign: "start", padding: "5px 6px", borderBottom: `1px solid ${C.border.input}`, fontWeight: "600" }}>
{rp.labels.item}
</th>
<th style={{ textAlign: "start", padding: "5px 6px", borderBottom: `1px solid ${C.border.input}`, fontWeight: "600" }}>
{rp.labels.resp}
</th>
<th style={{ textAlign: "start", padding: "5px 6px", borderBottom: `1px solid ${C.border.input}`, fontWeight: "600" }}>
{rp.labels.due}
</th>
<th style={{ textAlign: "start", padding: "5px 6px", borderBottom: `1px solid ${C.border.input}`, fontWeight: "600" }}>
{rp.labels.st}
</th>
</tr>
</thead>
<tbody>
{(rp.cas || []).map((c: any, __i: number) => (<Fragment key={__i}>
<tr>
<td style={{ padding: "5px 6px", borderBottom: `1px solid ${C.surface.track}`, fontFamily: FONT.mono }}>
{c.ref}
</td>
<td style={{ padding: "5px 6px", borderBottom: `1px solid ${C.surface.track}` }}>
{c.t}
</td>
<td style={{ padding: "5px 6px", borderBottom: `1px solid ${C.surface.track}` }}>
{c.resp}
</td>
<td style={{ padding: "5px 6px", borderBottom: `1px solid ${C.surface.track}` }}>
{c.due}
</td>
<td style={{ padding: "5px 6px", borderBottom: `1px solid ${C.surface.track}` }}>
{c.st}
</td>
</tr>
</Fragment>))}
</tbody>
</table>
</>) : null}
{rp.noCas ? (<>
<div style={{ color: C.text.secondary }}>
{rp.labels.noCA}
</div>
</>) : null}
</section>
{rp.hasGuards ? (<>
<section>
<h3 style={{ margin: "0 0 6px", fontSize: "13.5px", borderBottom: `1px solid ${C.text.ink}`, paddingBottom: "4px" }}>
{rp.labels.gd}
</h3>
{(rp.guards || []).map((g: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "flex", gap: "10px", padding: "4px 0", borderBottom: `1px solid ${C.surface.track}` }}>
<span style={{ flex: "1" }}>
{g.name}
</span>
<span style={{ fontFamily: FONT.mono, color: C.text.secondary }}>
{g.emp}
</span>
<span style={{ fontWeight: "600", minWidth: "40px", textAlign: "end" }}>
{g.score}
</span>
</div>
</Fragment>))}
</section>
</>) : null}
<section>
<h3 style={{ margin: "0 0 6px", fontSize: "13.5px", borderBottom: `1px solid ${C.text.ink}`, paddingBottom: "4px" }}>
{rp.histLabel}
</h3>
{(rp.hist || []).map((x: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "flex", gap: "10px", padding: "4px 0", borderBottom: `1px solid ${C.surface.track}`, fontSize: "11.5px", flexWrap: "wrap" }}>
<span style={{ minWidth: "110px", color: C.text.secondary }}>
{x.at}
</span>
<span style={{ fontWeight: "600", minWidth: "130px" }}>
{x.d}
</span>
<span>
{x.who} · {x.role}
</span>
<span style={{ flexBasis: "100%", color: C.text.body }}>
{x.reason}
</span>
</div>
</Fragment>))}
</section>
<section>
<h3 style={{ margin: "0 0 8px", fontSize: "13.5px", borderBottom: `1px solid ${C.text.ink}`, paddingBottom: "4px" }}>
{rp.labels.sig}
</h3>
<div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "12px" }}>
{(rp.sigs || []).map((g: any, __i: number) => (<Fragment key={__i}>
<div style={{ border: `1px solid ${C.border.input}`, padding: "10px" }}>
<div style={{ fontSize: "10.5px", color: C.text.secondary }}>
{g.k}
</div>
<div style={{ fontWeight: "600" }}>
{g.name}
</div>
<div style={{ fontSize: "11px", color: C.text.body }}>
{g.role}
</div>
<div style={{ fontSize: "11px", color: C.text.body }}>
{g.at}
</div>
<div style={{ fontFamily: FONT.mono, fontSize: "9.5px", color: C.text.muted, marginTop: "6px" }}>
{g.hash}
</div>
</div>
</Fragment>))}
</div>
</section>
<footer style={{ display: "flex", justifyContent: "space-between", gap: "10px", borderTop: `1px solid ${C.border.input}`, paddingTop: "8px", fontSize: "10.5px", color: C.text.secondary }}>
<span>
{rp.labels.conf}
</span>
<span>
{rp.footer}
</span>
</footer>
</article>
</div>
</div>
</>);
}
