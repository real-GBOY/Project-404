/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import { Fragment } from "react";
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";
import { FONT } from "@/styles/typography";

export function AccountRequestPublic({ vm }: { vm: VM }) {
  const { pub, t } = vm;
  return (<>
<div style={{ minHeight: "100%", background: C.surface.canvas, display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 14px 48px" }}>
<div style={{ width: "100%", maxWidth: "720px", display: "flex", flexDirection: "column", gap: "16px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
<div style={{ width: "34px", height: "34px", background: C.brand.primary, borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", color: C.surface.white, fontWeight: "700" }}>
{t.logoMark}
</div>
<div style={{ lineHeight: "1.2" }}>
<div style={{ fontWeight: "700", fontSize: "17px" }}>
{t.brand}
</div>
<div style={{ fontSize: "12px", color: C.text.secondary }}>
{t.accReqTitle}
</div>
</div>
</div>
{pub.done ? (<>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px", padding: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
<div style={{ fontSize: "13px", color: C.status.success.fg, fontWeight: "600" }}>
{t.reqReceived}
</div>
<div style={{ fontFamily: FONT.mono, fontSize: "22px" }}>
{pub.doneRef}
</div>
<div style={{ fontSize: "13.5px", color: C.text.body }}>
{t.reqNext}
</div>
<ol style={{ margin: "0", paddingInlineStart: "20px", fontSize: "13.5px", lineHeight: "1.8", color: C.text.body }}>
<li>
{t.rn1}
</li>
<li>
{t.rn2}
</li>
<li>
{t.rn3}
</li>
<li>
{t.rn4}
</li>
</ol>
<button onClick={pub.again} style={{ alignSelf: "flex-start", height: "42px", padding: "0 16px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, cursor: "pointer" }}>
{t.newRequest}
</button>
</section>
</>) : null}
{pub.notDone ? (<>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
{(pub.steps || []).map((x: any, __i: number) => (<Fragment key={__i}>
<span style={{ flex: "1", minWidth: "120px", borderBottom: `2px solid ${x.bd}`, color: x.fg, fontSize: "13px", padding: "6px 0", fontWeight: "500" }}>
{x.l}
</span>
</Fragment>))}
</div>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
{pub.s0 ? (<>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "12px" }}>
<label style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "13px", fontWeight: "500" }}>
{t.f_name}
<input value={pub.f.name} onChange={pub.on.name} style={{ height: "44px", border: `1px solid ${pub.bd.name}`, borderRadius: "4px", padding: "0 12px", fontSize: "15px", fontWeight: "400" }} />
</label>
<label style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "13px", fontWeight: "500" }}>
{t.f_nid}
<input value={pub.f.nid} onChange={pub.on.nid} inputMode="numeric" style={{ height: "44px", border: `1px solid ${pub.bd.nid}`, borderRadius: "4px", padding: "0 12px", fontSize: "15px", fontWeight: "400" }} />
</label>
<label style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "13px", fontWeight: "500" }}>
{t.f_empId}
<input value={pub.f.emp} onChange={pub.on.emp} style={{ height: "44px", border: `1px solid ${C.border.input}`, borderRadius: "4px", padding: "0 12px", fontSize: "15px", fontWeight: "400" }} />
</label>
<label style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "13px", fontWeight: "500" }}>
{t.f_email}
<input type="email" dir="ltr" value={pub.f.email} onChange={pub.on.email} style={{ height: "44px", border: `1px solid ${pub.bd.email}`, borderRadius: "4px", padding: "0 12px", fontSize: "15px", fontWeight: "400" }} />
</label>
<label style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "13px", fontWeight: "500" }}>
{t.f_phone}
<input type="tel" dir="ltr" value={pub.f.phone} onChange={pub.on.phone} style={{ height: "44px", border: `1px solid ${pub.bd.phone}`, borderRadius: "4px", padding: "0 12px", fontSize: "15px", fontWeight: "400" }} />
</label>
<label style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "13px", fontWeight: "500" }}>
{t.f_dept}
<input value={pub.f.dept} onChange={pub.on.dept} style={{ height: "44px", border: `1px solid ${pub.bd.dept}`, borderRadius: "4px", padding: "0 12px", fontSize: "15px", fontWeight: "400" }} />
</label>
<label style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "13px", fontWeight: "500" }}>
{t.f_reqRole}
<select value={pub.f.role} onChange={pub.on.role} style={{ height: "44px", border: `1px solid ${pub.bd.role}`, borderRadius: "4px", padding: "0 10px", fontSize: "15px", background: C.surface.white }}>
{(pub.roleOpts || []).map((o: any, __i: number) => (<Fragment key={__i}>
<option value={o.v}>
{o.l}
</option>
</Fragment>))}
</select>
</label>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
<span style={{ fontSize: "13px", fontWeight: "500" }}>
{t.f_reqProj}
</span>
<div style={{ display: "flex", flexDirection: "column", gap: "6px", border: `1px solid ${pub.bd.projects}`, borderRadius: "4px", padding: "8px 10px" }}>
{(pub.projChecks || []).map((p: any, __i: number) => (<Fragment key={__i}>
<label style={{ display: "flex", gap: "10px", alignItems: "center", minHeight: "36px", fontSize: "14px", cursor: "pointer" }}>
<input type="checkbox" checked={p.on} onChange={p.toggle} style={{ width: "20px", height: "20px", accentColor: C.brand.primary }} />
{p.l}
</label>
</Fragment>))}
</div>
</div>
<label style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "13px", fontWeight: "500" }}>
{t.justification}
<textarea value={pub.f.just} onChange={pub.on.just} rows={3} style={{ border: `1px solid ${pub.bd.just}`, borderRadius: "4px", padding: "10px 12px", fontSize: "15px", fontWeight: "400", resize: "vertical" }}></textarea>
</label>
{pub.err ? (<>
<div style={{ fontSize: "12.5px", color: C.status.danger.fg }}>
{pub.errTxt}
</div>
</>) : null}
<button onClick={pub.next1} style={{ alignSelf: "flex-end", height: "46px", padding: "0 22px", border: "0", borderRadius: "4px", background: C.brand.primary, color: C.surface.white, fontWeight: "500", cursor: "pointer" }}>
{t.continue}
</button>
</>) : null}
{pub.s1 ? (<>
<div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
<h2 style={{ margin: "0", fontSize: "16px", fontWeight: "600" }}>
{t.declTitle}
</h2>
<span style={{ fontFamily: FONT.mono, fontSize: "12px", color: C.text.secondary }}>
{pub.declVer}
</span>
</div>
<div style={{ maxHeight: "240px", overflowY: "auto", border: `1px solid ${C.border.hairline}`, borderRadius: "4px", padding: "12px 16px", background: C.surface.paper }}>
<ol style={{ margin: "0", paddingInlineStart: "18px", fontSize: "14px", lineHeight: "1.75" }}>
{(pub.decl || []).map((x: any, __i: number) => (<Fragment key={__i}>
<li>
{x.t}
</li>
</Fragment>))}
</ol>
</div>
<label style={{ display: "flex", gap: "10px", alignItems: "flex-start", fontSize: "14px", cursor: "pointer" }}>
<input type="checkbox" checked={pub.agree} onChange={pub.on.agree} style={{ width: "20px", height: "20px", accentColor: C.brand.primary, marginTop: "2px", flexShrink: "0" }} />
{t.declAgree}
</label>
<label style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "13px", fontWeight: "500" }}>
{t.typeName}
<input value={pub.f.sig} onChange={pub.on.sig} style={{ height: "48px", border: `1px solid ${pub.bd.sig}`, borderRadius: "4px", padding: "0 12px", fontSize: "18px", fontWeight: "500" }} />
</label>
<div style={{ fontSize: "12px", color: C.text.secondary }}>
{t.signedAt}: {pub.sigDate} · {t.sigCaptured}
</div>
{pub.declErr ? (<>
<div style={{ fontSize: "12.5px", color: C.status.danger.fg }}>
{t.declErr}
</div>
</>) : null}
<div style={{ display: "flex", gap: "8px", justifyContent: "space-between" }}>
<button onClick={pub.back0} style={{ height: "46px", padding: "0 18px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, cursor: "pointer" }}>
{t.back}
</button>
<button onClick={pub.next2} style={{ height: "46px", padding: "0 22px", border: "0", borderRadius: "4px", background: C.brand.primary, color: C.surface.white, fontWeight: "500", cursor: "pointer" }}>
{t.signContinue}
</button>
</div>
</>) : null}
{pub.s2 ? (<>
<dl style={{ margin: "0", border: `1px solid ${C.surface.track}`, borderRadius: "4px" }}>
{(pub.summary || []).map((r: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "flex", gap: "12px", padding: "9px 12px", borderBottom: `1px solid ${C.surface.subtle}`, fontSize: "13.5px", flexWrap: "wrap" }}>
<dt style={{ color: C.text.muted, minWidth: "140px" }}>
{r.k}
</dt>
<dd style={{ margin: "0", fontWeight: "500" }}>
{r.v}
</dd>
</div>
</Fragment>))}
</dl>
<div style={{ fontSize: "12.5px", color: C.text.secondary }}>
{t.reqInactive}
</div>
<div style={{ display: "flex", gap: "8px", justifyContent: "space-between" }}>
<button onClick={pub.back1} style={{ height: "46px", padding: "0 18px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, cursor: "pointer" }}>
{t.back}
</button>
<button onClick={pub.submit} style={{ height: "46px", padding: "0 22px", border: "0", borderRadius: "4px", background: C.brand.primary, color: C.surface.white, fontWeight: "500", cursor: "pointer" }}>
{t.submitRequest}
</button>
</div>
</>) : null}
</section>
<button onClick={pub.haveInvite} style={{ alignSelf: "center", background: "none", border: "0", color: C.brand.primary, fontSize: "13px", cursor: "pointer" }}>
{t.haveInvite}
</button>
</>) : null}
</div>
</div>
</>);
}
