/* eslint-disable */
// GENERATED from the approved Claude Design (Raqib.dc.html) by tools/transpile — do not hand-edit.
import { Fragment } from "react";
import type { VM } from "@/ui/vm";

export function ReportsIssued({ vm }: { vm: VM }) {
  const { pad, rl, t } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "1240px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
<div>
<h1 style={{ margin: "0", fontSize: "22px", fontWeight: "600" }}>
{t.nav_reports_l}
</h1>
<div style={{ fontSize: "13px", color: "#5C6168" }}>
{t.reportsSub}
</div>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: "8px" }}>
{(rl.types || []).map((x: any, __i: number) => (<Fragment key={__i}>
<div style={{ border: `1px solid ${x.bd}`, background: x.bg, borderRadius: "4px", padding: "12px 14px" }}>
<div style={{ fontWeight: "600", fontSize: "13.5px" }}>
{x.label}
</div>
<div style={{ fontSize: "12px", color: "#5C6168" }}>
{x.sub}
</div>
</div>
</Fragment>))}
</div>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 18px", borderBottom: "1px solid #EFEDE7" }}>
{t.generatedReports}
</h2>
{(rl.rows || []).map((r: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "flex", gap: "12px", alignItems: "center", padding: "12px 18px", borderBottom: "1px solid #F3F1EC", flexWrap: "wrap" }}>
<span style={{ flex: "1", minWidth: "220px" }}>
<span style={{ display: "block", fontWeight: "500" }}>
{r.proj} · {r.site}
</span>
<span style={{ display: "block", fontSize: "12px", color: "#8B9097" }}>
<span style={{ fontFamily: "'IBM Plex Mono',monospace" }}>
{r.rref}
</span>
 · {r.ref} · {t.approvedOnShort} {r.approved}
</span>
</span>
<span style={{ fontWeight: "600", color: r.scoreC }}>
{r.score}
</span>
<button onClick={r.go} style={{ height: "34px", padding: "0 12px", border: "1px solid #D6D3CB", borderRadius: "4px", background: "#fff", cursor: "pointer", fontSize: "13px" }}>
{t.view}
</button>
<button onClick={r.dl} style={{ height: "34px", padding: "0 12px", border: "1px solid #0F5C4A", color: "#0F5C4A", borderRadius: "4px", background: "#fff", cursor: "pointer", fontSize: "13px" }}>
PDF
</button>
</div>
</Fragment>))}
{rl.none ? (<>
<div style={{ padding: "24px", textAlign: "center", color: "#5C6168" }}>
{t.noReports}
</div>
</>) : null}
</section>
</div>
</>);
}
