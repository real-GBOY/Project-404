/* eslint-disable */
// GENERATED from the approved Claude Design (Raqib.dc.html) by tools/transpile — do not hand-edit.
import { Fragment } from "react";
import type { VM } from "@/ui/vm";

export function GuardProfile({ vm }: { vm: VM }) {
  const { arrBack, gp, mainCols, pad, t } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "1240px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
<button onClick={gp.back} style={{ alignSelf: "flex-start", background: "none", border: "0", padding: "0", color: "#0F5C4A", fontSize: "13px", cursor: "pointer" }}>
{arrBack} {t.nav_guards_h}
</button>
<div style={{ display: "flex", justifyContent: "space-between", gap: "12px 20px", flexWrap: "wrap", alignItems: "flex-end" }}>
<div>
<div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "12.5px", color: "#5C6168" }}>
{gp.emp} · {t.nid} {gp.nid}
</div>
<h1 style={{ margin: "2px 0", fontSize: "22px", fontWeight: "600" }}>
{gp.name}
</h1>
<div style={{ fontSize: "13px", color: "#5C6168" }}>
{gp.proj} · {gp.post} · {gp.shift}
</div>
</div>
<div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
<div style={{ textAlign: "end" }}>
<div style={{ fontSize: "12px", color: "#5C6168" }}>
{t.avgScore}
</div>
<div style={{ fontSize: "28px", fontWeight: "600", color: gp.avgC, lineHeight: "1.1" }}>
{gp.avg}
<span style={{ fontSize: "14px", color: "#8B9097" }}>
 / 5
</span>
</div>
</div>
{gp.canTrain ? (<>
<button onClick={gp.train} style={{ height: "40px", padding: "0 16px", border: "0", borderRadius: "4px", background: "#0F5C4A", color: "#fff", fontWeight: "500", cursor: "pointer" }}>
{t.requestTraining}
</button>
</>) : null}
</div>
</div>
{gp.hasFlag ? (<>
<div style={{ fontSize: "13px", color: "#6B4600", background: "#FAEFD8", border: "1px solid #EBD3A0", borderRadius: "4px", padding: "10px 12px" }}>
{gp.flag}
</div>
</>) : null}
<div style={{ display: "grid", gridTemplateColumns: mainCols, gap: "20px", alignItems: "start" }}>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
<div style={{ padding: "14px 18px", borderBottom: "1px solid #EFEDE7", display: "flex", justifyContent: "space-between", gap: "10px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600" }}>
{t.evalHistory}
</h2>
<span style={{ fontSize: "12px", color: "#8B9097" }}>
{gp.n} {t.evaluations}
</span>
</div>
<div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "90px", padding: "12px 18px 0", borderBottom: "1px solid #EFEDE7" }}>
{(gp.bars || []).map((b: any, __i: number) => (<Fragment key={__i}>
<div style={{ flex: "1", maxWidth: "40px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: "2px" }}>
<span style={{ fontSize: "10px", color: "#5C6168" }}>
{b.v}
</span>
<div style={{ width: "100%", height: b.h, background: b.c, borderRadius: "1px" }}></div>
</div>
</Fragment>))}
</div>
{(gp.evals || []).map((e: any, __i: number) => (<Fragment key={__i}>
<button onClick={e.go} style={{ width: "100%", display: "flex", gap: "12px", alignItems: "center", padding: "11px 18px", border: "0", borderBottom: "1px solid #F3F1EC", background: "#fff", cursor: "pointer", textAlign: "start", flexWrap: "wrap" }}>
<span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "12.5px", minWidth: "100px" }}>
{e.ref}
</span>
<span style={{ flex: "1", minWidth: "120px", fontSize: "12.5px", color: "#5C6168" }}>
{e.date} 
<span style={{ color: "#3D4247" }}>
{e.note}
</span>
</span>
<span style={{ height: "20px", padding: "0 7px", borderRadius: "3px", fontSize: "11.5px", color: e.st.fg, background: e.st.bg }}>
{e.st.label}
</span>
<span style={{ fontWeight: "600", color: e.scoreC, minWidth: "44px", textAlign: "end" }}>
{e.score}
</span>
</button>
</Fragment>))}
</section>
<div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: "0" }}>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 18px", borderBottom: "1px solid #EFEDE7" }}>
{t.trainingRecord}
</h2>
{(gp.rec || []).map((r: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "flex", gap: "10px", padding: "10px 18px", borderBottom: "1px solid #F3F1EC", fontSize: "13px" }}>
<span style={{ flex: "1" }}>
<span style={{ display: "block", fontWeight: "500" }}>
{r.course}
</span>
<span style={{ display: "block", fontSize: "12px", color: "#8B9097" }}>
<span style={{ fontFamily: "'IBM Plex Mono',monospace" }}>
{r.ref}
</span>
 · {r.date}
</span>
</span>
<span style={{ color: r.resC, fontWeight: "600", fontSize: "12.5px" }}>
{r.res}
</span>
</div>
</Fragment>))}
{(gp.trs || []).map((r: any, __i: number) => (<Fragment key={__i}>
<button onClick={r.go} style={{ width: "100%", display: "flex", gap: "10px", padding: "10px 18px", border: "0", borderBottom: "1px solid #F3F1EC", background: "#fff", cursor: "pointer", textAlign: "start", fontSize: "13px" }}>
<span style={{ flex: "1" }}>
<span style={{ display: "block", fontWeight: "500" }}>
{r.course}
</span>
<span style={{ display: "block", fontSize: "12px", color: "#8B9097" }}>
<span style={{ fontFamily: "'IBM Plex Mono',monospace" }}>
{r.ref}
</span>
 · {r.date}
</span>
</span>
<span style={{ height: "20px", padding: "0 7px", borderRadius: "3px", fontSize: "11.5px", color: r.st.fg, background: r.st.bg, whiteSpace: "nowrap" }}>
{r.st.label}
</span>
</button>
</Fragment>))}
</section>
{gp.hasObs ? (<>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 18px", borderBottom: "1px solid #EFEDE7" }}>
{t.relatedObs}
</h2>
{(gp.obs || []).map((o: any, __i: number) => (<Fragment key={__i}>
<button onClick={o.go} style={{ width: "100%", display: "block", padding: "10px 18px", border: "0", borderBottom: "1px solid #F3F1EC", background: "#fff", cursor: "pointer", textAlign: "start" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "500" }}>
{o.t} 
<span style={{ color: "#8A5A00", fontFamily: "'IBM Plex Mono',monospace" }}>
{o.rep}
</span>
</span>
<span style={{ display: "block", fontSize: "12px", color: "#8B9097" }}>
{o.ref} · {o.st.label}
</span>
</button>
</Fragment>))}
</section>
</>) : null}
{gp.hasCas ? (<>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 18px", borderBottom: "1px solid #EFEDE7" }}>
{t.relatedCAs}
</h2>
{(gp.cas || []).map((a: any, __i: number) => (<Fragment key={__i}>
<button onClick={a.go} style={{ width: "100%", display: "block", padding: "10px 18px", border: "0", borderBottom: "1px solid #F3F1EC", background: "#fff", cursor: "pointer", textAlign: "start" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "500" }}>
{a.t}
</span>
<span style={{ display: "block", fontSize: "12px", color: "#8B9097" }}>
{a.ref} · {a.st.label} · 
<span style={{ color: a.dueC }}>
{a.dueSub}
</span>
</span>
</button>
</Fragment>))}
</section>
</>) : null}
</div>
</div>
</div>
</>);
}
