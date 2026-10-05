/* eslint-disable */
// GENERATED from the approved Claude Design (Raqib.dc.html) by tools/transpile — do not hand-edit.
import { Fragment } from "react";
import type { VM } from "@/ui/vm";

export function AccountRequestReview({ vm }: { vm: VM }) {
  const { arrBack, mainCols, pad, rq2, t } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "1240px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
<button onClick={rq2.back} style={{ alignSelf: "flex-start", background: "none", border: "0", padding: "0", color: "#0F5C4A", fontSize: "13px", cursor: "pointer" }}>
{arrBack} {t.ut_requests}
</button>
<div>
<div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
<span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "12.5px", color: "#5C6168" }}>
{rq2.ref}
</span>
<span style={{ height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", fontWeight: "500", color: rq2.st.fg, background: rq2.st.bg, display: "inline-flex", alignItems: "center" }}>
{rq2.st.label}
</span>
</div>
<h1 style={{ margin: "4px 0 0", fontSize: "22px", fontWeight: "600" }}>
{rq2.name}
</h1>
</div>
<div style={{ display: "grid", gridTemplateColumns: mainCols, gap: "20px", alignItems: "start" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: "0" }}>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
<dl style={{ margin: "0", display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))" }}>
{(rq2.details || []).map((d: any, __i: number) => (<Fragment key={__i}>
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
{t.justification}
</div>
{rq2.just}
</div>
</section>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
<div style={{ padding: "14px 18px", borderBottom: "1px solid #EFEDE7", display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600" }}>
{t.declTitle}
</h2>
<span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px", color: "#5C6168" }}>
{rq2.declVer}
</span>
</div>
<ol style={{ margin: "0", padding: "12px 18px", paddingInlineStart: "36px", fontSize: "13.5px", lineHeight: "1.7" }}>
{(rq2.decl || []).map((x: any, __i: number) => (<Fragment key={__i}>
<li>
{x.t}
</li>
</Fragment>))}
</ol>
<div style={{ margin: "0 18px 16px", border: "1px solid #D6D3CB", borderRadius: "4px", padding: "12px 14px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "10px", background: "#FAF9F6" }}>
<div>
<div style={{ fontSize: "11.5px", color: "#8B9097" }}>
{t.declSigned}
</div>
<div style={{ fontWeight: "600", fontSize: "15px" }}>
{rq2.signed}
</div>
</div>
<div>
<div style={{ fontSize: "11.5px", color: "#8B9097" }}>
{t.signedAt}
</div>
<div style={{ fontSize: "13px" }}>
{rq2.signedAt}
</div>
</div>
<div>
<div style={{ fontSize: "11.5px", color: "#8B9097" }}>
IP
</div>
<div dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "12.5px", textAlign: "start" }}>
{rq2.ip}
</div>
</div>
<div>
<div style={{ fontSize: "11.5px", color: "#8B9097" }}>
{t.vm_hash}
</div>
<div dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px", textAlign: "start" }}>
{rq2.hash}
</div>
</div>
</div>
</section>
</div>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px", padding: "18px", display: "flex", flexDirection: "column", gap: "10px", position: "sticky", top: "16px" }}>
<div style={{ fontWeight: "600", fontSize: "15px" }}>
{t.decision}
</div>
{rq2.canDecide ? (<>
<div style={{ fontSize: "13px", color: "#5C6168" }}>
{t.accHint}
</div>
<button onClick={rq2.approve} style={{ height: "44px", border: "0", borderRadius: "4px", background: "#0F5C4A", color: "#fff", fontWeight: "500", cursor: "pointer" }}>
{t.approveAssign}
</button>
<button onClick={rq2.reject} style={{ height: "44px", border: "1px solid #E8C4C2", borderRadius: "4px", background: "#fff", color: "#A3262A", fontWeight: "500", cursor: "pointer" }}>
{t.reject}
</button>
</>) : null}
{rq2.isApproved ? (<>
<div style={{ fontSize: "13px" }}>
<div style={{ fontSize: "12px", color: "#8B9097" }}>
{t.assignedAccess}
</div>
{rq2.assigned}
</div>
</>) : null}
{rq2.setupPending ? (<>
<div style={{ fontSize: "13px", color: "#1F4E8C", background: "#E2EBF6", borderRadius: "4px", padding: "10px 12px" }}>
{rq2.setupTxt}
</div>
<button onClick={rq2.resend} style={{ height: "40px", border: "1px solid #D6D3CB", borderRadius: "4px", background: "#fff", cursor: "pointer" }}>
{t.resendLink}
</button>
<button onClick={rq2.openSetup} style={{ height: "40px", border: "1px solid #D6D3CB", borderRadius: "4px", background: "#fff", cursor: "pointer", fontSize: "13px" }}>
{t.openAsApplicant}
</button>
</>) : null}
{rq2.setupDone ? (<>
<div style={{ fontSize: "13px", color: "#1E6B45", background: "#E3F0E7", borderRadius: "4px", padding: "10px 12px", fontWeight: "500" }}>
{t.accountActive}
</div>
</>) : null}
{rq2.isRejected ? (<>
<div style={{ fontSize: "13px", background: "#F7E2E1", color: "#5A1416", borderRadius: "4px", padding: "10px 12px" }}>
<div style={{ fontWeight: "600" }}>
{t.rejectedReason}
</div>
{rq2.reason}
</div>
</>) : null}
{(rq2.hist || []).map((h: any, __i: number) => (<Fragment key={__i}>
<div style={{ fontSize: "12px", color: "#5C6168", borderTop: "1px solid #F3F1EC", paddingTop: "6px" }}>
{h.label} · {h.actor} · {h.at}
</div>
</Fragment>))}
</section>
</div>
</div>
</>);
}
