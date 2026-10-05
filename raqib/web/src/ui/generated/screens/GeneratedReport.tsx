/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import { Fragment } from "react";
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";
import { FONT } from "@/styles/typography";

export function GeneratedReport({ vm }: { vm: VM }) {
  const { arrBack, hpad, rg, t } = vm;
  return (<>
<div style={{ minHeight: "100%", background: C.border.soft, display: "flex", flexDirection: "column" }}>
<div style={{ position: "sticky", top: "0", zIndex: "4", background: C.surface.white, borderBottom: `1px solid ${C.border.hairline}`, display: "flex", alignItems: "center", gap: "10px", padding: `10px ${hpad}`, flexWrap: "wrap" }}>
<button onClick={rg.back} style={{ height: "38px", padding: "0 12px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, cursor: "pointer" }}>
{arrBack} {t.back}
</button>
<span style={{ fontFamily: FONT.mono, fontSize: "13px", flex: "1", minWidth: "120px" }}>
{rg.ref}
</span>
<div style={{ display: "flex", border: `1px solid ${C.border.input}`, borderRadius: "4px", overflow: "hidden" }}>
{(rg.langs || []).map((o: any, __i: number) => (<Fragment key={__i}>
<button onClick={o.set} style={{ border: "0", height: "34px", padding: "0 12px", fontSize: "13px", cursor: "pointer", background: o.bg, color: o.fg }}>
{o.label}
</button>
</Fragment>))}
</div>
<button onClick={rg.xls} style={{ height: "38px", padding: "0 14px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, cursor: "pointer" }}>
{t.exportExcel}
</button>
<button onClick={rg.pdf} style={{ height: "38px", padding: "0 16px", border: "0", borderRadius: "4px", background: C.brand.primary, color: C.surface.white, fontWeight: "500", cursor: "pointer" }}>
{t.downloadPdf}
</button>
</div>
<div style={{ padding: "24px 12px 48px", display: "flex", justifyContent: "center" }}>
<article data-print-root="1" data-print-title={rg.ref} dir={rg.dir} style={{ width: "100%", maxWidth: "794px", background: C.surface.white, boxShadow: `0 1px 3px ${C.shadow.soft},0 8px 24px ${C.shadow.hairline}`, padding: "44px 48px", display: "flex", flexDirection: "column", gap: "20px", fontSize: "12.5px", lineHeight: "1.5", color: C.text.ink, fontFamily: FONT.sans }}>
<header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px", borderBottom: `2px solid ${C.text.ink}`, paddingBottom: "14px" }}>
<div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
<div style={{ width: "34px", height: "34px", background: C.brand.primary, borderRadius: "4px", color: C.surface.white, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700" }}>
ر
</div>
<div style={{ lineHeight: "1.25" }}>
<div style={{ fontWeight: "700", fontSize: "15px" }}>
رقيب · Raqib
</div>
<div style={{ fontSize: "11px", color: C.text.secondary }}>
{rg.dept}
</div>
</div>
</div>
<div style={{ width: "120px", height: "44px", border: `1px dashed ${C.border.strong}`, background: `repeating-linear-gradient(135deg,${C.surface.paperAlt} 0 6px,${C.surface.track} 6px 12px)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT.mono, fontSize: "10px", color: C.text.secondary }}>
{rg.logo}
</div>
</header>
<div>
<div style={{ fontSize: "20px", fontWeight: "700" }}>
{rg.title}
</div>
<div style={{ fontFamily: FONT.mono, fontSize: "12px", color: C.text.secondary }}>
{rg.ref}
</div>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", border: `1px solid ${C.border.input}` }}>
{(rg.kv || []).map((m: any, __i: number) => (<Fragment key={__i}>
<div style={{ padding: "7px 10px", borderBottom: `1px solid ${C.border.hairline}`, borderInlineEnd: `1px solid ${C.border.hairline}` }}>
<div style={{ fontSize: "10.5px", color: C.text.secondary }}>
{m.k}
</div>
<div style={{ fontWeight: "600" }}>
{m.v}
</div>
</div>
</Fragment>))}
</div>
{(rg.tables || []).map((tb: any, __i: number) => (<Fragment key={__i}>
<section>
<h3 style={{ margin: "0 0 6px", fontSize: "13.5px", borderBottom: `1px solid ${C.text.ink}`, paddingBottom: "4px" }}>
{tb.t}
</h3>
<table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11.5px" }}>
<thead>
<tr style={{ background: C.text.ink, color: C.surface.white }}>
{(tb.cols || []).map((c: any, __i: number) => (<Fragment key={__i}>
<th style={{ textAlign: "start", padding: "6px 8px", fontWeight: "500" }}>
{c.c}
</th>
</Fragment>))}
</tr>
</thead>
<tbody>
{(tb.rows || []).map((r: any, __i: number) => (<Fragment key={__i}>
<tr>
{(r.cells || []).map((c: any, __i: number) => (<Fragment key={__i}>
<td style={{ padding: "5px 8px", borderBottom: `1px solid ${C.border.hairline}` }}>
{c.c}
</td>
</Fragment>))}
</tr>
</Fragment>))}
</tbody>
</table>
{tb.empty ? (<>
<div style={{ color: C.text.secondary, padding: "6px 0" }}>
{tb.noRows}
</div>
</>) : null}
</section>
</Fragment>))}
<footer style={{ display: "flex", justifyContent: "space-between", gap: "10px", borderTop: `1px solid ${C.border.input}`, paddingTop: "8px", fontSize: "10.5px", color: C.text.secondary }}>
<span>
{rg.conf}
</span>
<span>
{rg.gen}
</span>
</footer>
</article>
</div>
</div>
</>);
}
