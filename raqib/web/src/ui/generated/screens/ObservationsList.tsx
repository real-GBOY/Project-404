/* eslint-disable */
// GENERATED from the approved Claude Design (Raqib.dc.html) by tools/transpile — do not hand-edit.
import { Fragment } from "react";
import { Hover } from "@/ui/Hover";
import type { VM } from "@/ui/vm";

export function ObservationsList({ vm }: { vm: VM }) {
  const { ol, pad, t } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "1360px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
<div>
<h1 style={{ margin: "0", fontSize: "22px", fontWeight: "600" }}>
{t.nav_observations_l}
</h1>
<div style={{ fontSize: "13px", color: "#5C6168" }}>
{t.obsSub}
</div>
</div>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
{(ol.chips || []).map((c: any, __i: number) => (<Fragment key={__i}>
<button onClick={c.go} style={{ height: "32px", padding: "0 12px", borderRadius: "16px", border: `1px solid ${c.bd}`, background: c.bg, color: c.fg, fontSize: "12.5px", cursor: "pointer" }}>
{c.label}
</button>
</Fragment>))}
</div>
{ol.has ? (<>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
{(ol.rows || []).map((o: any, __i: number) => (<Fragment key={__i}>
<Hover as="button" onClick={o.go} style={{ width: "100%", display: "flex", gap: "10px 16px", alignItems: "center", padding: "13px 18px", border: "0", borderBottom: "1px solid #EFEDE7", background: "#fff", cursor: "pointer", textAlign: "start", flexWrap: "wrap" }} hover={{ background: "#FAF9F6" }}>
<span style={{ flex: "1", minWidth: "240px" }}>
<span style={{ display: "flex", gap: "8px", alignItems: "center" }}>
<span style={{ height: "20px", padding: "0 7px", borderRadius: "3px", fontSize: "11.5px", color: o.kind.fg, background: o.kind.bg, display: "inline-flex", alignItems: "center" }}>
{o.kind.label}
</span>
<span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px", color: "#5C6168" }}>
{o.ref}
</span>
</span>
<span style={{ display: "block", fontWeight: "500", marginTop: "2px" }}>
{o.t}
</span>
<span style={{ display: "block", fontSize: "12px", color: "#8B9097" }}>
{o.proj} · {o.site} · {o.visit} · {t.item} {o.item} · {o.resp}
</span>
</span>
{o.hasRep ? (<>
<span style={{ fontFamily: "'IBM Plex Mono',monospace", color: "#8A5A00", fontWeight: "600" }}>
{o.rep}
</span>
</>) : null}
<span style={{ height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", color: o.sev.fg, background: o.sev.bg, display: "inline-flex", alignItems: "center" }}>
{o.sev.label}
</span>
<span style={{ fontSize: "12px", color: "#5C6168", minWidth: "80px" }}>
<span style={{ display: "block" }}>
{t.c_due} {o.due}
</span>
<span style={{ display: "block", fontFamily: "'IBM Plex Mono',monospace" }}>
{o.ca}
</span>
</span>
<span style={{ height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", fontWeight: "500", color: o.st.fg, background: o.st.bg, display: "inline-flex", alignItems: "center" }}>
{o.st.label}
</span>
</Hover>
</Fragment>))}
</section>
</>) : null}
{ol.none ? (<>
<div style={{ background: "#fff", border: "1px dashed #D6D3CB", borderRadius: "6px", padding: "40px 20px", textAlign: "center", color: "#5C6168" }}>
{t.noResults}
</div>
</>) : null}
</div>
</>);
}
