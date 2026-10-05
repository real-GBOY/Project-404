/* eslint-disable */
// GENERATED from the approved Claude Design (Raqib.dc.html) by tools/transpile — do not hand-edit.
import { Fragment } from "react";
import { Hover } from "@/ui/Hover";
import type { VM } from "@/ui/vm";

export function ActionsList({ vm }: { vm: VM }) {
  const { cl, pad, t } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "1360px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
<div>
<h1 style={{ margin: "0", fontSize: "22px", fontWeight: "600" }}>
{t.nav_actions_l}
</h1>
<div style={{ fontSize: "13px", color: "#5C6168" }}>
{t.caListSub}
</div>
</div>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
{(cl.chips || []).map((c: any, __i: number) => (<Fragment key={__i}>
<button onClick={c.go} style={{ height: "32px", padding: "0 12px", borderRadius: "16px", border: `1px solid ${c.bd}`, background: c.bg, color: c.fg, fontSize: "12.5px", cursor: "pointer" }}>
{c.label}
</button>
</Fragment>))}
</div>
{cl.has ? (<>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
{(cl.rows || []).map((a: any, __i: number) => (<Fragment key={__i}>
<Hover as="button" onClick={a.go} style={{ width: "100%", display: "flex", gap: "10px 18px", alignItems: "center", padding: "13px 18px", border: "0", borderBottom: "1px solid #EFEDE7", background: "#fff", cursor: "pointer", textAlign: "start", flexWrap: "wrap" }} hover={{ background: "#FAF9F6" }}>
<span style={{ flex: "1", minWidth: "240px" }}>
<span style={{ display: "block", fontWeight: "500" }}>
{a.t}
</span>
<span style={{ display: "block", fontSize: "12px", color: "#8B9097" }}>
<span style={{ fontFamily: "'IBM Plex Mono',monospace" }}>
{a.ref}
</span>
 · {a.proj} · {a.resp}
</span>
</span>
{a.hasRep ? (<>
<span style={{ fontSize: "12px", color: "#8A5A00", fontWeight: "500" }}>
{a.rep}
</span>
</>) : null}
<span style={{ height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", color: a.pri.fg, background: a.pri.bg, display: "inline-flex", alignItems: "center" }}>
{a.pri.label}
</span>
<span style={{ fontSize: "12.5px", color: a.dueC, textAlign: "end", lineHeight: "1.3", minWidth: "90px" }}>
<span style={{ display: "block" }}>
{a.due}
</span>
<span style={{ display: "block", fontWeight: "500" }}>
{a.dueSub}
</span>
</span>
<span style={{ height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", fontWeight: "500", color: a.st.fg, background: a.st.bg, display: "inline-flex", alignItems: "center", minWidth: "90px", justifyContent: "center" }}>
{a.st.label}
</span>
</Hover>
</Fragment>))}
</section>
</>) : null}
{cl.none ? (<>
<div style={{ background: "#fff", border: "1px dashed #D6D3CB", borderRadius: "6px", padding: "40px 20px", textAlign: "center", color: "#5C6168" }}>
{t.noCAFilter}
</div>
</>) : null}
</div>
</>);
}
