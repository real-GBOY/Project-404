/* eslint-disable */
// GENERATED from the approved Claude Design (Raqib.dc.html) by tools/transpile — do not hand-edit.
import { Fragment } from "react";
import type { VM } from "@/ui/vm";

export function AccessDenied({ vm }: { vm: VM }) {
  const { dn, pad, t } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "620px", margin: "40px auto" }}>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px", padding: "28px", display: "flex", flexDirection: "column", gap: "14px" }}>
<div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px", color: "#A3262A", letterSpacing: ".06em" }}>
403
</div>
<h1 style={{ margin: "0", fontSize: "22px", fontWeight: "600" }}>
{dn.title}
</h1>
<div style={{ fontSize: "14px", color: "#3D4247" }}>
{dn.body}
</div>
<dl style={{ margin: "0", border: "1px solid #EFEDE7", borderRadius: "4px" }}>
{(dn.rows || []).map((r: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "flex", gap: "12px", padding: "8px 12px", borderBottom: "1px solid #F3F1EC", fontSize: "13px" }}>
<dt style={{ color: "#8B9097", minWidth: "110px" }}>
{r.k}
</dt>
<dd style={{ margin: "0", fontWeight: "500" }}>
{r.v}
</dd>
</div>
</Fragment>))}
</dl>
<div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
<button onClick={dn.home} style={{ height: "42px", padding: "0 16px", border: "0", borderRadius: "4px", background: "#0F5C4A", color: "#fff", cursor: "pointer" }}>
{t.backHome}
</button>
{dn.canRequest ? (<>
<button onClick={dn.request} style={{ height: "42px", padding: "0 16px", border: "1px solid #D6D3CB", borderRadius: "4px", background: "#fff", cursor: "pointer" }}>
{t.requestAccess}
</button>
</>) : null}
</div>
</section>
</div>
</>);
}
