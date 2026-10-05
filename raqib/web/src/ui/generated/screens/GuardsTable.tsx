/* eslint-disable */
// GENERATED from the approved Claude Design (Raqib.dc.html) by tools/transpile — do not hand-edit.
import { Fragment } from "react";
import { Hover } from "@/ui/Hover";
import type { VM } from "@/ui/vm";

export function GuardsTable({ vm }: { vm: VM }) {
  const { gd, hpad, t } = vm;
  return (<>
<div style={{ padding: `0 ${hpad} 32px`, maxWidth: "1180px", margin: "0 auto" }}>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 18px", borderBottom: "1px solid #EFEDE7" }}>
{t.guardsInScope}
</h2>
{(gd.rows || []).map((g: any, __i: number) => (<Fragment key={__i}>
<Hover as="button" onClick={g.go} style={{ width: "100%", border: "0", background: "#fff", cursor: "pointer", textAlign: "start", display: "flex", gap: "14px", alignItems: "center", padding: "12px 18px", borderBottom: "1px solid #F3F1EC", flexWrap: "wrap" }} hover={{ background: "#FAF9F6" }}>
<span style={{ flex: "1", minWidth: "200px" }}>
<span style={{ display: "block", fontWeight: "500" }}>
{g.name}
</span>
<span style={{ display: "block", fontSize: "12px", color: "#8B9097" }}>
<span style={{ fontFamily: "'IBM Plex Mono',monospace" }}>
{g.emp}
</span>
 · {g.post} · {g.proj}
</span>
{g.hasFlag ? (<>
<span style={{ display: "block", fontSize: "12px", color: "#8A5A00", marginTop: "2px" }}>
{g.flag}
</span>
</>) : null}
</span>
<span style={{ fontSize: "12px", color: "#5C6168" }}>
{g.evals} {t.evaluations}
</span>
<span style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "130px" }}>
<span style={{ flex: "1", height: "6px", background: "#EFEDE7", borderRadius: "3px", overflow: "hidden", display: "block" }}>
<span style={{ display: "block", height: "100%", width: g.avgW, background: g.avgC }}></span>
</span>
<span style={{ fontWeight: "600", color: g.avgC, fontVariantNumeric: "tabular-nums" }}>
{g.avg}
</span>
</span>
</Hover>
</Fragment>))}
</section>
</div>
</>);
}
