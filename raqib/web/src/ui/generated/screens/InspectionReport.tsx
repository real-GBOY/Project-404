/* eslint-disable */
// GENERATED from the approved Claude Design (Raqib.dc.html) by tools/transpile — do not hand-edit.
import { Fragment } from "react";
import type { VM } from "@/ui/vm";

export function InspectionReport({ vm }: { vm: VM }) {
  const { arrBack, hpad, rp, t } = vm;
  return (<>
<div style={{ minHeight: "100%", background: "#D9D6CF", display: "flex", flexDirection: "column" }}>
<div style={{ position: "sticky", top: "0", zIndex: "4", background: "#fff", borderBottom: "1px solid #E3E1DA", display: "flex", alignItems: "center", gap: "10px", padding: `10px ${hpad}`, flexWrap: "wrap" }}>
<button onClick={rp.back} style={{ height: "38px", padding: "0 12px", border: "1px solid #D6D3CB", borderRadius: "4px", background: "#fff", cursor: "pointer" }}>
{arrBack} {t.back}
</button>
<span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "13px", flex: "1", minWidth: "120px" }}>
{rp.ref}
</span>
<span style={{ fontSize: "12.5px", color: "#5C6168" }}>
{t.reportLang}
</span>
<div style={{ display: "flex", border: "1px solid #D6D3CB", borderRadius: "4px", overflow: "hidden" }}>
{(rp.langs || []).map((o: any, __i: number) => (<Fragment key={__i}>
<button onClick={o.set} style={{ border: "0", height: "34px", padding: "0 12px", fontSize: "13px", cursor: "pointer", background: o.bg, color: o.fg }}>
{o.label}
</button>
</Fragment>))}
</div>
<button onClick={rp.excel} style={{ height: "38px", padding: "0 14px", border: "1px solid #D6D3CB", borderRadius: "4px", background: "#fff", cursor: "pointer" }}>
{t.exportExcel}
</button>
<button onClick={rp.download} style={{ height: "38px", padding: "0 16px", border: "0", borderRadius: "4px", background: "#0F5C4A", color: "#fff", fontWeight: "500", cursor: "pointer" }}>
{t.downloadPdf}
</button>
</div>
<div style={{ padding: "24px 12px 48px", display: "flex", justifyContent: "center" }}>
<article data-print-root="1" data-print-title={rp.printTitle} dir={rp.dir} style={{ width: "100%", maxWidth: "794px", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.12),0 8px 24px rgba(0,0,0,.08)", padding: "44px 48px", display: "flex", flexDirection: "column", gap: "22px", fontSize: "12.5px", lineHeight: "1.5", color: "#191C1F" }}>
<header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px", borderBottom: "2px solid #191C1F", paddingBottom: "16px" }}>
<div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
<div style={{ width: "34px", height: "34px", background: "#0F5C4A", borderRadius: "4px", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700" }}>
ر
</div>
<div style={{ lineHeight: "1.25" }}>
<div style={{ fontWeight: "700", fontSize: "15px" }}>
رقيب · Raqib
</div>
<div style={{ fontSize: "11px", color: "#5C6168" }}>
{rp.dept}
</div>
</div>
</div>
<div style={{ width: "120px", height: "44px", border: "1px dashed #C9C6BE", background: "repeating-linear-gradient(135deg,#F6F5F1 0 6px,#EFEDE7 6px 12px)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono',monospace", fontSize: "10px", color: "#5C6168" }}>
{rp.labels.logo}
</div>
</header>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
<div>
<div style={{ fontSize: "20px", fontWeight: "700" }}>
{rp.title}
</div>
<div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px", color: "#5C6168" }}>
{rp.ref}
</div>
</div>
<div style={{ border: `2px solid ${rp.statusC}`, color: rp.statusC, padding: "4px 12px", fontWeight: "700", fontSize: "13px", borderRadius: "2px" }}>
{rp.status}
</div>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", border: "1px solid #D6D3CB" }}>
{(rp.meta || []).map((m: any, __i: number) => (<Fragment key={__i}>
<div style={{ padding: "7px 10px", borderBottom: "1px solid #E3E1DA", borderInlineEnd: "1px solid #E3E1DA" }}>
<div style={{ fontSize: "10.5px", color: "#5C6168" }}>
{m.k}
</div>
<div style={{ fontWeight: "500" }}>
{m.v}
</div>
</div>
</Fragment>))}
</div>
<div style={{ fontSize: "11px", color: "#5C6168", border: "1px solid #E3E1DA", padding: "6px 10px", display: "flex", gap: "16px", flexWrap: "wrap" }}>
<span>
{rp.shiftLabel}: {rp.shift}
</span>
<span>
{rp.versionNote}
</span>
</div>
<div style={{ display: "flex", gap: "24px", alignItems: "center", background: "#F6F5F1", padding: "14px 16px" }}>
<div style={{ fontSize: "36px", fontWeight: "700", color: rp.scoreC, lineHeight: "1" }}>
{rp.score}
</div>
<div>
<div style={{ fontWeight: "600", fontSize: "14px" }}>
{rp.labels.summary} — {rp.rating}
</div>
<div style={{ color: "#3D4247" }}>
{rp.counts}
</div>
</div>
</div>
<table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11.5px" }}>
<thead>
<tr style={{ background: "#191C1F", color: "#fff" }}>
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
<td colSpan={6} style={{ padding: "7px 8px", background: "#ECEAE5", fontWeight: "600" }}>
{r.label}
</td>
</tr>
</>) : null}
{r.isQ ? (<>
<tr>
<td style={{ padding: "6px 8px", borderBottom: "1px solid #E3E1DA", fontFamily: "'IBM Plex Mono',monospace" }}>
{r.num}
</td>
<td style={{ padding: "6px 8px", borderBottom: "1px solid #E3E1DA" }}>
{r.text}
</td>
<td style={{ padding: "6px 8px", borderBottom: "1px solid #E3E1DA", textAlign: "center" }}>
{r.w}
</td>
<td style={{ padding: "6px 8px", borderBottom: "1px solid #E3E1DA", color: r.resC, fontWeight: "600" }}>
{r.res}
</td>
<td style={{ padding: "6px 8px", borderBottom: "1px solid #E3E1DA", textAlign: "center" }}>
{r.pts}
</td>
<td style={{ padding: "6px 8px", borderBottom: "1px solid #E3E1DA", color: "#3D4247" }}>
{r.note}
</td>
</tr>
</>) : null}
</Fragment>))}
</tbody>
</table>
{rp.hasViol ? (<>
<section>
<h3 style={{ margin: "0 0 6px", fontSize: "13.5px", borderBottom: "1px solid #191C1F", paddingBottom: "4px" }}>
{rp.labels.viol}
</h3>
{(rp.viol || []).map((x: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "flex", gap: "10px", padding: "5px 0", borderBottom: "1px solid #EFEDE7" }}>
<span style={{ fontFamily: "'IBM Plex Mono',monospace", minWidth: "32px" }}>
{x.num}
</span>
<span style={{ flex: "1" }}>
<span style={{ fontWeight: "600" }}>
{x.text}
</span>
 — {x.note}
</span>
<span style={{ color: "#A3262A", fontWeight: "600" }}>
{x.sev}
</span>
</div>
</Fragment>))}
</section>
</>) : null}
{rp.hasEvid ? (<>
<section>
<h3 style={{ margin: "0 0 8px", fontSize: "13.5px", borderBottom: "1px solid #191C1F", paddingBottom: "4px" }}>
{rp.labels.ev}
</h3>
<div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: "8px" }}>
{(rp.evid || []).map((e: any, __i: number) => (<Fragment key={__i}>
<div>
<div style={{ height: "72px", position: "relative", overflow: "hidden", background: "repeating-linear-gradient(135deg,#F0EEE8 0 6px,#E8E5DE 6px 12px)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #E3E1DA" }}>
{e.hasUrl ? (<>
<div style={{ position: "absolute", inset: "0", backgroundPosition: "center", backgroundSize: "cover", backgroundRepeat: "no-repeat", backgroundImage: e.bgImg }}></div>
</>) : null}
<span style={{ position: "relative", fontFamily: "'IBM Plex Mono',monospace", fontSize: "9.5px", background: "rgba(255,255,255,.85)", padding: "1px 4px" }}>
{e.kind}
</span>
</div>
<div style={{ fontSize: "10px", color: "#5C6168", marginTop: "2px", fontFamily: "'IBM Plex Mono',monospace" }}>
{e.ref}
</div>
<div dir="ltr" style={{ fontSize: "10px", color: "#3D4247", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "start" }}>
{e.cap}
</div>
</div>
</Fragment>))}
</div>
</section>
</>) : null}
<section>
<h3 style={{ margin: "0 0 6px", fontSize: "13.5px", borderBottom: "1px solid #191C1F", paddingBottom: "4px" }}>
{rp.labels.ca}
</h3>
{rp.hasCas ? (<>
<table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11.5px" }}>
<thead>
<tr>
<th style={{ textAlign: "start", padding: "5px 6px", borderBottom: "1px solid #D6D3CB", fontWeight: "600" }}>
#
</th>
<th style={{ textAlign: "start", padding: "5px 6px", borderBottom: "1px solid #D6D3CB", fontWeight: "600" }}>
{rp.labels.item}
</th>
<th style={{ textAlign: "start", padding: "5px 6px", borderBottom: "1px solid #D6D3CB", fontWeight: "600" }}>
{rp.labels.resp}
</th>
<th style={{ textAlign: "start", padding: "5px 6px", borderBottom: "1px solid #D6D3CB", fontWeight: "600" }}>
{rp.labels.due}
</th>
<th style={{ textAlign: "start", padding: "5px 6px", borderBottom: "1px solid #D6D3CB", fontWeight: "600" }}>
{rp.labels.st}
</th>
</tr>
</thead>
<tbody>
{(rp.cas || []).map((c: any, __i: number) => (<Fragment key={__i}>
<tr>
<td style={{ padding: "5px 6px", borderBottom: "1px solid #EFEDE7", fontFamily: "'IBM Plex Mono',monospace" }}>
{c.ref}
</td>
<td style={{ padding: "5px 6px", borderBottom: "1px solid #EFEDE7" }}>
{c.t}
</td>
<td style={{ padding: "5px 6px", borderBottom: "1px solid #EFEDE7" }}>
{c.resp}
</td>
<td style={{ padding: "5px 6px", borderBottom: "1px solid #EFEDE7" }}>
{c.due}
</td>
<td style={{ padding: "5px 6px", borderBottom: "1px solid #EFEDE7" }}>
{c.st}
</td>
</tr>
</Fragment>))}
</tbody>
</table>
</>) : null}
{rp.noCas ? (<>
<div style={{ color: "#5C6168" }}>
{rp.labels.noCA}
</div>
</>) : null}
</section>
{rp.hasGuards ? (<>
<section>
<h3 style={{ margin: "0 0 6px", fontSize: "13.5px", borderBottom: "1px solid #191C1F", paddingBottom: "4px" }}>
{rp.labels.gd}
</h3>
{(rp.guards || []).map((g: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "flex", gap: "10px", padding: "4px 0", borderBottom: "1px solid #EFEDE7" }}>
<span style={{ flex: "1" }}>
{g.name}
</span>
<span style={{ fontFamily: "'IBM Plex Mono',monospace", color: "#5C6168" }}>
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
<h3 style={{ margin: "0 0 6px", fontSize: "13.5px", borderBottom: "1px solid #191C1F", paddingBottom: "4px" }}>
{rp.histLabel}
</h3>
{(rp.hist || []).map((x: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "flex", gap: "10px", padding: "4px 0", borderBottom: "1px solid #EFEDE7", fontSize: "11.5px", flexWrap: "wrap" }}>
<span style={{ minWidth: "110px", color: "#5C6168" }}>
{x.at}
</span>
<span style={{ fontWeight: "600", minWidth: "130px" }}>
{x.d}
</span>
<span>
{x.who} · {x.role}
</span>
<span style={{ flexBasis: "100%", color: "#3D4247" }}>
{x.reason}
</span>
</div>
</Fragment>))}
</section>
<section>
<h3 style={{ margin: "0 0 8px", fontSize: "13.5px", borderBottom: "1px solid #191C1F", paddingBottom: "4px" }}>
{rp.labels.sig}
</h3>
<div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "12px" }}>
{(rp.sigs || []).map((g: any, __i: number) => (<Fragment key={__i}>
<div style={{ border: "1px solid #D6D3CB", padding: "10px" }}>
<div style={{ fontSize: "10.5px", color: "#5C6168" }}>
{g.k}
</div>
<div style={{ fontWeight: "600" }}>
{g.name}
</div>
<div style={{ fontSize: "11px", color: "#3D4247" }}>
{g.role}
</div>
<div style={{ fontSize: "11px", color: "#3D4247" }}>
{g.at}
</div>
<div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "9.5px", color: "#8B9097", marginTop: "6px" }}>
{g.hash}
</div>
</div>
</Fragment>))}
</div>
</section>
<footer style={{ display: "flex", justifyContent: "space-between", gap: "10px", borderTop: "1px solid #D6D3CB", paddingTop: "8px", fontSize: "10.5px", color: "#5C6168" }}>
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
