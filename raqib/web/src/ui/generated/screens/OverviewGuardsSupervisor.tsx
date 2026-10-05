/* eslint-disable */
// GENERATED from the approved Claude Design (Raqib.dc.html) by tools/transpile — do not hand-edit.
import { Fragment } from "react";
import type { VM } from "@/ui/vm";

export function OverviewGuardsSupervisor({ vm }: { vm: VM }) {
  const { gd, greeting, pad, t, todayLong } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "1180px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" }}>
<div>
<div style={{ fontSize: "13px", color: "#5C6168" }}>
{todayLong}
</div>
<h1 style={{ margin: "2px 0 0", fontSize: "22px", fontWeight: "600" }}>
{greeting}
</h1>
</div>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
<div style={{ padding: "14px 18px", borderBottom: "1px solid #EFEDE7", display: "flex", justifyContent: "space-between" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600" }}>
{t.trainingRequests}
</h2>
</div>
{(gd.training || []).map((r: any, __i: number) => (<Fragment key={__i}>
<button onClick={r.go} style={{ width: "100%", border: "0", background: "#fff", cursor: "pointer", textAlign: "start", display: "flex", gap: "12px", alignItems: "center", padding: "12px 18px", borderBottom: "1px solid #F3F1EC", flexWrap: "wrap" }}>
<span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px", color: "#5C6168" }}>
{r.ref}
</span>
<span style={{ flex: "1", minWidth: "200px" }}>
<span style={{ display: "block", fontWeight: "500" }}>
{r.who}
</span>
<span style={{ display: "block", fontSize: "12.5px", color: "#5C6168" }}>
{r.what}
</span>
</span>
<span style={{ height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", color: r.st.fg, background: r.st.bg, display: "inline-flex", alignItems: "center" }}>
{r.st.label}
</span>
</button>
</Fragment>))}
</section>
</div>
</>);
}
