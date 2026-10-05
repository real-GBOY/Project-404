/* eslint-disable */
// GENERATED from the approved Claude Design (Raqib.dc.html) by tools/transpile — do not hand-edit.
import { Fragment } from "react";
import { Hover } from "@/ui/Hover";
import type { VM } from "@/ui/vm";

export function FormsList({ vm }: { vm: VM }) {
  const { fl, pad, pageTitle, t } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "1360px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "12px", flexWrap: "wrap" }}>
<div>
<h1 style={{ margin: "0", fontSize: "22px", fontWeight: "600" }}>
{pageTitle}
</h1>
<div style={{ fontSize: "13px", color: "#5C6168" }}>
{t.formsSub}
</div>
</div>
{fl.canAdd ? (<>
<button onClick={fl.add} style={{ height: "40px", padding: "0 16px", border: "0", borderRadius: "4px", background: "#0F5C4A", color: "#fff", fontWeight: "500", cursor: "pointer" }}>
{t.newForm}
</button>
</>) : null}
</div>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
{(fl.rows || []).map((f: any, __i: number) => (<Fragment key={__i}>
<Hover as="button" onClick={f.go} style={{ width: "100%", display: "flex", gap: "10px 20px", alignItems: "center", padding: "14px 18px", border: "0", borderBottom: "1px solid #EFEDE7", background: "#fff", cursor: "pointer", textAlign: "start", flexWrap: "wrap" }} hover={{ background: "#FAF9F6" }}>
<span style={{ flex: "1", minWidth: "240px" }}>
<span style={{ display: "block", fontWeight: "500" }}>
{f.name}
</span>
<span style={{ display: "block", fontSize: "12px", color: "#8B9097" }}>
<span style={{ fontFamily: "'IBM Plex Mono',monospace" }}>
{f.code}
</span>
 · {f.cat} · {f.by} · {f.updated}
</span>
</span>
<span style={{ lineHeight: "1.25" }}>
<span style={{ display: "block", fontSize: "11px", color: "#8B9097" }}>
{t.curVersion}
</span>
<span style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: "600" }}>
{f.cur}
</span>
</span>
{f.hasDraft ? (<>
<span style={{ height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", color: "#8A5A00", background: "#FAEFD8", display: "inline-flex", alignItems: "center" }}>
{f.draft}
</span>
</>) : null}
<span style={{ fontSize: "12px", color: "#5C6168" }}>
{f.nver} {t.versionsWord} · {f.uses} {t.inspWord}
</span>
<span style={{ height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", fontWeight: "500", color: f.st.fg, background: f.st.bg, display: "inline-flex", alignItems: "center" }}>
{f.st.label}
</span>
</Hover>
</Fragment>))}
</section>
<div style={{ fontSize: "12.5px", color: "#3D4247", background: "#ECEAE5", borderRadius: "4px", padding: "10px 12px" }}>
{t.formsVersionNote}
</div>
</div>
</>);
}
