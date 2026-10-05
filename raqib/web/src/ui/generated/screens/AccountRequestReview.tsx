/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import { Fragment } from "react";
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";
import { FONT } from "@/styles/typography";

export function AccountRequestReview({ vm }: { vm: VM }) {
  const { arrBack, mainCols, pad, rq2, t } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "1240px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
<button onClick={rq2.back} style={{ alignSelf: "flex-start", background: "none", border: "0", padding: "0", color: C.brand.primary, fontSize: "13px", cursor: "pointer" }}>
{arrBack} {t.ut_requests}
</button>
<div>
<div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
<span style={{ fontFamily: FONT.mono, fontSize: "12.5px", color: C.text.secondary }}>
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
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px" }}>
<dl style={{ margin: "0", display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))" }}>
{(rq2.details || []).map((d: any, __i: number) => (<Fragment key={__i}>
<div style={{ padding: "11px 18px", borderBottom: `1px solid ${C.surface.subtle}` }}>
<dt style={{ fontSize: "12px", color: C.text.muted }}>
{d.k}
</dt>
<dd style={{ margin: "2px 0 0", fontSize: "13.5px", fontWeight: "500" }}>
{d.v}
</dd>
</div>
</Fragment>))}
</dl>
<div style={{ padding: "12px 18px", fontSize: "13.5px" }}>
<div style={{ fontSize: "12px", color: C.text.muted }}>
{t.justification}
</div>
{rq2.just}
</div>
</section>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px" }}>
<div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.surface.track}`, display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600" }}>
{t.declTitle}
</h2>
<span style={{ fontFamily: FONT.mono, fontSize: "12px", color: C.text.secondary }}>
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
<div style={{ margin: "0 18px 16px", border: `1px solid ${C.border.input}`, borderRadius: "4px", padding: "12px 14px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "10px", background: C.surface.paper }}>
<div>
<div style={{ fontSize: "11.5px", color: C.text.muted }}>
{t.declSigned}
</div>
<div style={{ fontWeight: "600", fontSize: "15px" }}>
{rq2.signed}
</div>
</div>
<div>
<div style={{ fontSize: "11.5px", color: C.text.muted }}>
{t.signedAt}
</div>
<div style={{ fontSize: "13px" }}>
{rq2.signedAt}
</div>
</div>
<div>
<div style={{ fontSize: "11.5px", color: C.text.muted }}>
IP
</div>
<div dir="ltr" style={{ fontFamily: FONT.mono, fontSize: "12.5px", textAlign: "start" }}>
{rq2.ip}
</div>
</div>
<div>
<div style={{ fontSize: "11.5px", color: C.text.muted }}>
{t.vm_hash}
</div>
<div dir="ltr" style={{ fontFamily: FONT.mono, fontSize: "12px", textAlign: "start" }}>
{rq2.hash}
</div>
</div>
</div>
</section>
</div>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px", padding: "18px", display: "flex", flexDirection: "column", gap: "10px", position: "sticky", top: "16px" }}>
<div style={{ fontWeight: "600", fontSize: "15px" }}>
{t.decision}
</div>
{rq2.canDecide ? (<>
<div style={{ fontSize: "13px", color: C.text.secondary }}>
{t.accHint}
</div>
<button onClick={rq2.approve} style={{ height: "44px", border: "0", borderRadius: "4px", background: C.brand.primary, color: C.surface.white, fontWeight: "500", cursor: "pointer" }}>
{t.approveAssign}
</button>
<button onClick={rq2.reject} style={{ height: "44px", border: `1px solid ${C.status.danger.border}`, borderRadius: "4px", background: C.surface.white, color: C.status.danger.fg, fontWeight: "500", cursor: "pointer" }}>
{t.reject}
</button>
</>) : null}
{rq2.isApproved ? (<>
<div style={{ fontSize: "13px" }}>
<div style={{ fontSize: "12px", color: C.text.muted }}>
{t.assignedAccess}
</div>
{rq2.assigned}
</div>
</>) : null}
{rq2.setupPending ? (<>
<div style={{ fontSize: "13px", color: C.status.info.fg, background: C.status.info.bg, borderRadius: "4px", padding: "10px 12px" }}>
{rq2.setupTxt}
</div>
<button onClick={rq2.resend} style={{ height: "40px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, cursor: "pointer" }}>
{t.resendLink}
</button>
<button onClick={rq2.openSetup} style={{ height: "40px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, cursor: "pointer", fontSize: "13px" }}>
{t.openAsApplicant}
</button>
</>) : null}
{rq2.setupDone ? (<>
<div style={{ fontSize: "13px", color: C.status.success.fg, background: C.status.success.bg, borderRadius: "4px", padding: "10px 12px", fontWeight: "500" }}>
{t.accountActive}
</div>
</>) : null}
{rq2.isRejected ? (<>
<div style={{ fontSize: "13px", background: C.status.danger.bg, color: C.status.danger.deep, borderRadius: "4px", padding: "10px 12px" }}>
<div style={{ fontWeight: "600" }}>
{t.rejectedReason}
</div>
{rq2.reason}
</div>
</>) : null}
{(rq2.hist || []).map((h: any, __i: number) => (<Fragment key={__i}>
<div style={{ fontSize: "12px", color: C.text.secondary, borderTop: `1px solid ${C.surface.subtle}`, paddingTop: "6px" }}>
{h.label} · {h.actor} · {h.at}
</div>
</Fragment>))}
</section>
</div>
</div>
</>);
}
