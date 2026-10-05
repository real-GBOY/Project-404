/* eslint-disable */
// GENERATED from the approved Claude Design (Raqib.dc.html) by tools/transpile — do not hand-edit.
import { Fragment } from "react";
import type { VM } from "@/ui/vm";

export function TrainingDetail({ vm }: { vm: VM }) {
  const { arrBack, mainCols, pad, t, td } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "1240px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
<button onClick={td.back} style={{ alignSelf: "flex-start", background: "none", border: "0", padding: "0", color: "#0F5C4A", fontSize: "13px", cursor: "pointer" }}>
{arrBack} {t.nav_training_h}
</button>
<div>
<div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
<span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "12.5px", color: "#5C6168" }}>
{td.ref}
</span>
<span style={{ height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", fontWeight: "500", color: td.st.fg, background: td.st.bg, display: "inline-flex", alignItems: "center" }}>
{td.st.label}
</span>
<span style={{ height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", color: td.pri.fg, background: td.pri.bg, display: "inline-flex", alignItems: "center" }}>
{t.priority}: {td.pri.label}
</span>
{td.esc ? (<>
<span style={{ fontSize: "11.5px", color: "#A3262A", border: "1px solid #E8C4C2", borderRadius: "2px", padding: "1px 6px" }}>
{t.escalated}
</span>
</>) : null}
</div>
<h1 style={{ margin: "4px 0 2px", fontSize: "22px", fontWeight: "600" }}>
{td.course}
</h1>
<button onClick={td.guardGo} style={{ background: "none", border: "0", padding: "0", fontSize: "13px", color: "#0F5C4A", cursor: "pointer" }}>
{td.who} · {td.emp} · {td.proj}
</button>
</div>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px", padding: "16px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: "12px" }}>
{(td.steps || []).map((st: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
<span style={{ width: "22px", height: "22px", borderRadius: "50%", background: st.dot, border: `2px solid ${st.dbd}`, color: "#fff", fontSize: "11px", fontWeight: "700", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>
{st.mark}
</span>
<span>
<span style={{ display: "block", fontSize: "13px", fontWeight: st.fw, color: st.fg }}>
{st.label}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#8B9097" }}>
{st.sub}
</span>
</span>
</div>
</Fragment>))}
</section>
<div style={{ display: "grid", gridTemplateColumns: mainCols, gap: "20px", alignItems: "start" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: "0" }}>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
<dl style={{ margin: "0", display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))" }}>
{(td.details || []).map((d: any, __i: number) => (<Fragment key={__i}>
<div style={{ padding: "11px 18px", borderBottom: "1px solid #F3F1EC" }}>
<dt style={{ fontSize: "12px", color: "#8B9097" }}>
{d.k}
</dt>
<dd style={{ margin: "2px 0 0", fontSize: "13.5px", fontWeight: "500" }}>
{d.v}
</dd>
</div>
</Fragment>))}
</dl>
<div style={{ padding: "12px 18px", fontSize: "13.5px" }}>
<div style={{ fontSize: "12px", color: "#8B9097" }}>
{t.c_notes}
</div>
{td.notes}
</div>
</section>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px", padding: "16px 18px" }}>
<h2 style={{ margin: "0 0 14px", fontSize: "15px", fontWeight: "600" }}>
{t.workflowHistory}
</h2>
{(td.hist || []).map((h: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "grid", gridTemplateColumns: "14px 1fr", gap: "10px" }}>
<div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
<span style={{ width: "10px", height: "10px", borderRadius: "50%", background: h.c, marginTop: "5px", flexShrink: "0" }}></span>
<span style={{ flex: "1", width: "1px", background: "#E3E1DA", marginTop: "4px" }}></span>
</div>
<div style={{ paddingBottom: "14px" }}>
<div style={{ fontWeight: "500", fontSize: "13.5px" }}>
{h.label}
</div>
<div style={{ fontSize: "12px", color: "#5C6168" }}>
{h.actor} · {h.role} · {h.at}
</div>
{h.hasReason ? (<>
<div style={{ marginTop: "6px", fontSize: "13px", background: "#FAF9F6", border: "1px solid #EFEDE7", borderRadius: "4px", padding: "8px 10px" }}>
{h.reason}
</div>
</>) : null}
</div>
</div>
</Fragment>))}
</section>
</div>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px", padding: "18px", display: "flex", flexDirection: "column", gap: "10px", position: "sticky", top: "16px" }}>
<div style={{ fontWeight: "600", fontSize: "15px" }}>
{t.decision}
</div>
{td.isPM ? (<>
<div style={{ fontSize: "13px", color: "#5C6168" }}>
{t.trPmHint}
</div>
<button onClick={td.approve} style={{ height: "44px", border: "0", borderRadius: "4px", background: "#0F5C4A", color: "#fff", fontWeight: "500", cursor: "pointer" }}>
{t.approve}
</button>
<button onClick={td.ret} style={{ height: "44px", border: "1px solid #E5C98F", borderRadius: "4px", background: "#fff", color: "#8A5A00", fontWeight: "500", cursor: "pointer" }}>
{t.returnLabel}
</button>
<button onClick={td.rej} style={{ height: "44px", border: "1px solid #E8C4C2", borderRadius: "4px", background: "#fff", color: "#A3262A", fontWeight: "500", cursor: "pointer" }}>
{t.reject}
</button>
</>) : null}
{td.isGS ? (<>
<label style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "13px", fontWeight: "500" }}>
{t.c_notes}
<textarea value={td.editNotes} onChange={td.onNotes} rows={4} style={{ border: "1px solid #D6D3CB", borderRadius: "4px", padding: "10px 12px", fontSize: "14px", fontWeight: "400", resize: "vertical" }}></textarea>
</label>
<button onClick={td.resubmit} style={{ height: "44px", border: "0", borderRadius: "4px", background: "#0F5C4A", color: "#fff", fontWeight: "500", cursor: "pointer" }}>
{t.resubmitReq}
</button>
</>) : null}
{td.canSched ? (<>
<button onClick={td.sched} style={{ height: "44px", border: "0", borderRadius: "4px", background: "#0F5C4A", color: "#fff", fontWeight: "500", cursor: "pointer" }}>
{t.scheduleTraining}
</button>
</>) : null}
{td.canDone ? (<>
<button onClick={td.done} style={{ height: "44px", border: "0", borderRadius: "4px", background: "#0F5C4A", color: "#fff", fontWeight: "500", cursor: "pointer" }}>
{t.recordCompletion}
</button>
</>) : null}
{td.showWait ? (<>
<div style={{ fontSize: "13px", color: "#3D4247" }}>
{td.waitTxt}
</div>
</>) : null}
</section>
</div>
</div>
</>);
}
