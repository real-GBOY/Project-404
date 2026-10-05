/* eslint-disable */
// GENERATED from the approved Claude Design (Raqib.dc.html) by tools/transpile — do not hand-edit.
import { Fragment } from "react";
import type { VM } from "@/ui/vm";

export function PasswordSetup({ vm }: { vm: VM }) {
  const { su, t } = vm;
  return (<>
<div style={{ minHeight: "100%", background: "#F5F4F0", display: "flex", justifyContent: "center", padding: "32px 14px" }}>
<section style={{ width: "100%", maxWidth: "460px", background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px", padding: "24px", display: "flex", flexDirection: "column", gap: "12px", alignSelf: "flex-start" }}>
<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
<div style={{ width: "30px", height: "30px", background: "#0F5C4A", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: "700" }}>
{t.logoMark}
</div>
<span style={{ fontWeight: "600" }}>
{t.setupTitle}
</span>
</div>
{su.valid ? (<>
<div style={{ fontSize: "14px" }}>
{t.welcome} 
<b>
{su.name}
</b>
</div>
<div style={{ fontSize: "12.5px", color: "#5C6168", background: "#FAF9F6", borderRadius: "4px", padding: "10px 12px" }}>
{su.role} · {su.proj}
<br  />
<span dir="ltr">
{su.email}
</span>
 · {su.expires}
</div>
<label style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "13px", fontWeight: "500" }}>
{t.newPassword}
<input type="password" value={su.a} onChange={su.onA} autoComplete="new-password" style={{ height: "46px", border: "1px solid #D6D3CB", borderRadius: "4px", padding: "0 12px", fontSize: "16px" }} />
</label>
<label style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "13px", fontWeight: "500" }}>
{t.confirmPassword}
<input type="password" value={su.b} onChange={su.onB} autoComplete="new-password" style={{ height: "46px", border: "1px solid #D6D3CB", borderRadius: "4px", padding: "0 12px", fontSize: "16px" }} />
</label>
<div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
{(su.rules || []).map((r: any, __i: number) => (<Fragment key={__i}>
<div style={{ fontSize: "13px", color: r.c, display: "flex", gap: "8px" }}>
<span>
{r.mark}
</span>
{r.l}
</div>
</Fragment>))}
</div>
<div style={{ fontSize: "12.5px", color: "#5C6168" }}>
{su.mfa}
</div>
<button onClick={su.submit} disabled={su.notOk} style={{ height: "48px", border: "0", borderRadius: "4px", background: su.bg, color: "#fff", fontWeight: "500", cursor: "pointer" }}>
{t.activateAccount}
</button>
</>) : null}
{su.used ? (<>
<div style={{ fontSize: "14px", color: "#1E6B45", fontWeight: "600" }}>
{t.accountActive}
</div>
<div style={{ fontSize: "13px", color: "#3D4247" }}>
{t.signInNow}
</div>
</>) : null}
{su.invalid ? (<>
<div style={{ fontSize: "14px", fontWeight: "600" }}>
{t.linkInvalid}
</div>
<div style={{ fontSize: "13px", color: "#3D4247" }}>
{t.linkInvalidSub}
</div>
</>) : null}
<button onClick={su.toRequest} style={{ background: "none", border: "0", color: "#0F5C4A", fontSize: "13px", cursor: "pointer", alignSelf: "flex-start", padding: "0" }}>
{t.accReqTitle}
</button>
</section>
</div>
</>);
}
