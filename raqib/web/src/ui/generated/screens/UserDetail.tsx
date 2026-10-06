/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import { Fragment } from "react";
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";
import { FONT } from "@/styles/typography";

export function UserDetail({ vm }: { vm: VM }) {
  const { arrBack, mainCols, pad, t, ud } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "1240px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
<button onClick={ud.back} style={{ alignSelf: "flex-start", background: "none", border: "0", padding: "0", color: C.brand.primary, fontSize: "13px", cursor: "pointer" }}>
{arrBack} {t.nav_users_h}
</button>
<div style={{ display: "flex", justifyContent: "space-between", gap: "12px 20px", flexWrap: "wrap", alignItems: "center" }}>
<div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
<span style={{ width: "52px", height: "52px", borderRadius: "50%", background: C.surface.sunken, fontWeight: "600", display: "flex", alignItems: "center", justifyContent: "center" }}>
{ud.ini}
</span>
<div>
<h1 style={{ margin: "0", fontSize: "22px", fontWeight: "600" }}>
{ud.name}
</h1>
<div style={{ fontSize: "13px", color: C.text.secondary }}>
{ud.title} · {ud.role} · 
<span dir="ltr">
{ud.email}
</span>
</div>
</div>
<span style={{ height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", fontWeight: "500", color: ud.st.fg, background: ud.st.bg, display: "inline-flex", alignItems: "center" }}>
{ud.st.label}
</span>
</div>
{ud.canEdit ? (<>
<div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
<button onClick={ud.toggleStatus} style={{ height: "40px", padding: "0 14px", border: `1px solid ${C.status.danger.border}`, borderRadius: "4px", background: C.surface.white, color: C.status.danger.fg, cursor: "pointer" }}>
{ud.statusLabel}
</button>
{ud.canScope ? (<>
<button onClick={ud.editScope} style={{ height: "40px", padding: "0 14px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, cursor: "pointer" }}>
{t.editScope}
</button>
</>) : null}
<button onClick={ud.editProfile} style={{ height: "40px", padding: "0 14px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, cursor: "pointer" }}>
{t.pa_editProfile}
</button>
{ud.canMfaReset ? (<>
<button onClick={ud.resetMfa} style={{ height: "40px", padding: "0 14px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, cursor: "pointer" }}>
{t.pa_resetMfa}
</button>
</>) : null}
{ud.canExport ? (<>
<button onClick={ud.exportData} style={{ height: "40px", padding: "0 14px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, cursor: "pointer" }}>
{t.pa_exportData}
</button>
</>) : null}
<button onClick={ud.changeRole} style={{ height: "40px", padding: "0 14px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, cursor: "pointer" }}>
{t.changeRole}
</button>
</div>
</>) : null}
</div>
{ud.isInvited ? (<>
<div style={{ fontSize: "13px", color: C.status.info.fg, background: C.status.info.bg, borderRadius: "4px", padding: "10px 12px" }}>
{ud.invitedTxt}
</div>
</>) : null}
<div style={{ display: "grid", gridTemplateColumns: mainCols, gap: "20px", alignItems: "start" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: "0" }}>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 18px", borderBottom: `1px solid ${C.surface.track}` }}>
{t.roleTemplate} — {ud.role}
</h2>
{(ud.perms || []).map((p: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "flex", gap: "12px", padding: "9px 18px", borderBottom: `1px solid ${C.surface.subtle}`, fontSize: "13px", flexWrap: "wrap" }}>
<span style={{ minWidth: "150px", fontWeight: "500" }}>
{p.mod}
</span>
<span style={{ color: C.text.body }}>
{p.acts}
</span>
</div>
</Fragment>))}
</section>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 18px", borderBottom: `1px solid ${C.surface.track}` }}>
{t.recentActivity}
</h2>
{(ud.acts || []).map((a: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "flex", gap: "12px", padding: "9px 18px", borderBottom: `1px solid ${C.surface.subtle}`, fontSize: "13px", flexWrap: "wrap" }}>
<span style={{ flex: "1", minWidth: "200px" }}>
{a.act} 
<span style={{ fontFamily: FONT.mono, fontSize: "12px", color: C.text.secondary }}>
{a.ref}
</span>
</span>
<span style={{ fontSize: "12px", color: C.text.muted }}>
{a.at}
</span>
</div>
</Fragment>))}
{ud.noActs ? (<>
<div style={{ padding: "14px 18px", fontSize: "13px", color: C.text.secondary }}>
—
</div>
</>) : null}
</section>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: "0" }}>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 18px", borderBottom: `1px solid ${C.surface.track}` }}>
{t.projectScope}
</h2>
<div style={{ padding: "10px 18px", fontSize: "12.5px", color: C.text.secondary }}>
{ud.scopeRule}
</div>
{(ud.scope || []).map((x: any, __i: number) => (<Fragment key={__i}>
<div style={{ padding: "8px 18px", borderTop: `1px solid ${C.surface.subtle}`, fontSize: "13.5px" }}>
{x}
</div>
</Fragment>))}
{ud.noScope ? (<>
<div style={{ padding: "8px 18px 14px", fontSize: "13px", color: C.status.danger.fg }}>
{t.noScope}
</div>
</>) : null}
</section>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px", padding: "14px 18px", display: "flex", flexDirection: "column", gap: "6px" }}>
<div style={{ fontSize: "12px", color: C.text.muted }}>
{t.lastActivity}
</div>
<div style={{ fontWeight: "500" }}>
{ud.last}
</div>
<div style={{ fontSize: "12px", color: C.text.muted, marginTop: "8px" }}>
{t.nav_confidential_h}
</div>
<div style={{ fontSize: "13px" }}>
{ud.conf}
</div>
</section>
</div>
</div>
</div>
</>);
}
