/* eslint-disable */
// GENERATED from the approved Claude Design (Raqib.dc.html) by tools/transpile — do not hand-edit.
import { Fragment } from "react";
import { Hover } from "@/ui/Hover";
import type { VM } from "@/ui/vm";

export function OverviewGuard({ vm }: { vm: VM }) {
  const { arr, greeting, gu, pad, t } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "640px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" }}>
<div>
<h1 style={{ margin: "0", fontSize: "22px", fontWeight: "600" }}>
{greeting}
</h1>
<div style={{ fontSize: "13px", color: "#5C6168" }}>
{gu.sub}
</div>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
{(gu.actions || []).map((a: any, __i: number) => (<Fragment key={__i}>
<Hover as="button" onClick={a.go} style={{ display: "flex", alignItems: "center", gap: "14px", minHeight: "72px", padding: "14px 18px", border: "1px solid #E3E1DA", borderRadius: "6px", background: "#fff", cursor: "pointer", textAlign: "start" }} hover={{ borderColor: "#0F5C4A" }}>
<span style={{ flex: "1" }}>
<span style={{ display: "block", fontSize: "16px", fontWeight: "600" }}>
{a.label}
</span>
<span style={{ display: "block", fontSize: "13px", color: "#5C6168" }}>
{a.sub}
</span>
</span>
<span style={{ color: "#0F5C4A", fontSize: "18px" }}>
{arr}
</span>
</Hover>
</Fragment>))}
</div>
<div style={{ fontSize: "13px", color: "#3D4247", background: "#ECEAE5", borderRadius: "4px", padding: "12px 14px" }}>
{t.guardPrivacy}
</div>
{gu.hasResp ? (<>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 16px", borderBottom: "1px solid #EFEDE7" }}>
{t.responsesToYou}
</h2>
{(gu.responses || []).map((r: any, __i: number) => (<Fragment key={__i}>
<button onClick={r.go} style={{ width: "100%", display: "block", padding: "14px 16px", border: "0", borderBottom: "1px solid #F3F1EC", background: "#fff", cursor: "pointer", textAlign: "start" }}>
<span style={{ display: "block", fontSize: "12px", color: "#5C6168", fontFamily: "'IBM Plex Mono',monospace" }}>
{r.ref}
</span>
<span style={{ display: "block", fontWeight: "500" }}>
{r.subject}
</span>
<span style={{ display: "block", fontSize: "13.5px", color: "#3D4247", marginTop: "4px" }}>
{r.resp}
</span>
</button>
</Fragment>))}
</section>
</>) : null}
</div>
</>);
}
