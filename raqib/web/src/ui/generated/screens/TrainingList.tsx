/* eslint-disable */
// GENERATED from the approved Claude Design (Raqib.dc.html) by tools/transpile — do not hand-edit.
import { Fragment } from "react";
import { Hover } from "@/ui/Hover";
import type { VM } from "@/ui/vm";

export function TrainingList({ vm }: { vm: VM }) {
  const { pad, pageTitle, t, tl } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "1360px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "12px", flexWrap: "wrap" }}>
<div>
<h1 style={{ margin: "0", fontSize: "22px", fontWeight: "600" }}>
{pageTitle}
</h1>
<div style={{ fontSize: "13px", color: "#5C6168" }}>
{t.trSub}
</div>
</div>
{tl.canAdd ? (<>
<button onClick={tl.add} style={{ height: "40px", padding: "0 16px", border: "0", borderRadius: "4px", background: "#0F5C4A", color: "#fff", fontWeight: "500", cursor: "pointer" }}>
{t.newTraining}
</button>
</>) : null}
</div>
<div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "2px" }}>
{(tl.chips || []).map((c: any, __i: number) => (<Fragment key={__i}>
<button onClick={c.go} style={{ flexShrink: "0", height: "32px", padding: "0 12px", borderRadius: "16px", border: `1px solid ${c.bd}`, background: c.bg, color: c.fg, fontSize: "12.5px", cursor: "pointer", whiteSpace: "nowrap" }}>
{c.label}
</button>
</Fragment>))}
</div>
{tl.has ? (<>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
{(tl.rows || []).map((r: any, __i: number) => (<Fragment key={__i}>
<Hover as="button" onClick={r.go} style={{ width: "100%", display: "flex", gap: "10px 18px", alignItems: "center", padding: "13px 18px", border: "0", borderBottom: "1px solid #EFEDE7", background: "#fff", cursor: "pointer", textAlign: "start", flexWrap: "wrap" }} hover={{ background: "#FAF9F6" }}>
<span style={{ flex: "1", minWidth: "240px" }}>
<span style={{ display: "flex", gap: "8px", alignItems: "center" }}>
<span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px", color: "#5C6168" }}>
{r.ref}
</span>
{r.esc ? (<>
<span style={{ fontSize: "11px", color: "#A3262A", border: "1px solid #E8C4C2", borderRadius: "2px", padding: "0 5px" }}>
{t.escalated}
</span>
</>) : null}
</span>
<span style={{ display: "block", fontWeight: "500", marginTop: "2px" }}>
{r.course}
</span>
<span style={{ display: "block", fontSize: "12px", color: "#8B9097" }}>
{r.who} · {r.emp} · {r.proj} · {r.reason}
</span>
</span>
<span style={{ fontSize: "12px", color: "#5C6168" }}>
{r.at}
</span>
<span style={{ height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", color: r.pri.fg, background: r.pri.bg, display: "inline-flex", alignItems: "center" }}>
{r.pri.label}
</span>
<span style={{ height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", fontWeight: "500", color: r.st.fg, background: r.st.bg, display: "inline-flex", alignItems: "center", whiteSpace: "nowrap" }}>
{r.st.label}
</span>
</Hover>
</Fragment>))}
</section>
</>) : null}
{tl.none ? (<>
<div style={{ background: "#fff", border: "1px dashed #D6D3CB", borderRadius: "6px", padding: "36px 20px", textAlign: "center", color: "#5C6168" }}>
{t.noResults}
</div>
</>) : null}
</div>
</>);
}
