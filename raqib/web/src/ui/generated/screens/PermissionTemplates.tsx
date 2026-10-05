/* eslint-disable */
// GENERATED from the approved Claude Design (Raqib.dc.html) by tools/transpile — do not hand-edit.
import { Fragment } from "react";
import type { VM } from "@/ui/vm";

export function PermissionTemplates({ vm }: { vm: VM }) {
  const { pad, pageTitle, pv, t } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "1360px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
<div>
<h1 style={{ margin: "0", fontSize: "22px", fontWeight: "600" }}>
{pageTitle}
</h1>
<div style={{ fontSize: "13px", color: "#5C6168" }}>
{t.permsSub}
</div>
</div>
<div style={{ display: "flex", gap: "4px", borderBottom: "1px solid #E3E1DA", overflowX: "auto" }}>
{(pv.tabs || []).map((tb: any, __i: number) => (<Fragment key={__i}>
<button onClick={tb.go} style={{ height: "42px", padding: "0 14px", border: "0", borderBottom: `2px solid ${tb.bd}`, background: "none", color: tb.fg, fontWeight: tb.fw, fontSize: "13.5px", cursor: "pointer", marginBottom: "-1px", whiteSpace: "nowrap" }}>
{tb.label}
</button>
</Fragment>))}
</div>
{pv.isRoles ? (<>
<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
{(pv.roles || []).map((o: any, __i: number) => (<Fragment key={__i}>
<button onClick={o.set} style={{ height: "34px", padding: "0 12px", border: "1px solid #D6D3CB", borderRadius: "17px", background: o.bg, color: o.fg, fontSize: "13px", cursor: "pointer" }}>
{o.label}
</button>
</Fragment>))}
</div>
<div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
<div style={{ fontSize: "13px", color: "#3D4247" }}>
<b>
{pv.roleName}
</b>
 · {pv.nUsers} · {t.scope}: {pv.scopeRule}
</div>
{pv.canEdit ? (<>
<div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
{pv.notEditing ? (<>
<button onClick={pv.edit} style={{ height: "38px", padding: "0 14px", border: "1px solid #D6D3CB", borderRadius: "4px", background: "#fff", cursor: "pointer" }}>
{t.editTemplate}
</button>
</>) : null}
{pv.editing ? (<>
<span style={{ fontSize: "12.5px", color: "#8A5A00" }}>
{pv.nDiff}
</span>
<button onClick={pv.cancel} style={{ height: "38px", padding: "0 14px", border: "1px solid #D6D3CB", borderRadius: "4px", background: "#fff", cursor: "pointer" }}>
{t.cancel}
</button>
<button onClick={pv.save} style={{ height: "38px", padding: "0 16px", border: "0", borderRadius: "4px", background: "#0F5C4A", color: "#fff", cursor: "pointer" }}>
{t.saveChanges}
</button>
</>) : null}
</div>
</>) : null}
</div>
<div style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px", overflowX: "auto" }}>
<table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", minWidth: "760px" }}>
<thead>
<tr style={{ background: "#FAF9F6" }}>
<th style={{ textAlign: "start", padding: "10px 14px", fontWeight: "500", color: "#5C6168", fontSize: "12px", borderBottom: "1px solid #E3E1DA" }}>
{t.module}
</th>
{(pv.acts || []).map((a: any, __i: number) => (<Fragment key={__i}>
<th style={{ padding: "10px 6px", fontWeight: "500", color: "#5C6168", fontSize: "12px", borderBottom: "1px solid #E3E1DA", textAlign: "center" }}>
{a.l}
</th>
</Fragment>))}
</tr>
</thead>
<tbody>
{(pv.rows || []).map((r: any, __i: number) => (<Fragment key={__i}>
<tr>
<td style={{ padding: "9px 14px", borderBottom: "1px solid #EFEDE7", fontWeight: "500" }}>
{r.mod}
</td>
{(r.cells || []).map((c: any, __i: number) => (<Fragment key={__i}>
<td style={{ padding: "6px", borderBottom: "1px solid #EFEDE7", textAlign: "center" }}>
{c.app ? (<>
<button onClick={c.toggle} style={{ width: "26px", height: "26px", borderRadius: "4px", border: `1.5px solid ${c.bd}`, background: c.bg, color: "#fff", fontSize: "13px", fontWeight: "700", cursor: c.cur }}>
{c.mark}
</button>
</>) : null}
{c.na ? (<>
<span style={{ color: "#C9C6BE" }}>
—
</span>
</>) : null}
</td>
</Fragment>))}
</tr>
</Fragment>))}
</tbody>
</table>
</div>
<div style={{ fontSize: "12.5px", color: "#3D4247", background: "#ECEAE5", borderRadius: "4px", padding: "10px 12px" }}>
{t.permVsScope}
</div>
</>) : null}
{pv.isScope ? (<>
<div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
<div style={{ fontSize: "13px", color: "#3D4247" }}>
{t.scopeSub}
</div>
{pv.canEdit ? (<>
<div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
{pv.sNotEditing ? (<>
<button onClick={pv.sEdit} style={{ height: "38px", padding: "0 14px", border: "1px solid #D6D3CB", borderRadius: "4px", background: "#fff", cursor: "pointer" }}>
{t.editScope}
</button>
</>) : null}
{pv.sEditing ? (<>
<span style={{ fontSize: "12.5px", color: "#8A5A00" }}>
{pv.sDiff}
</span>
<button onClick={pv.sCancel} style={{ height: "38px", padding: "0 14px", border: "1px solid #D6D3CB", borderRadius: "4px", background: "#fff", cursor: "pointer" }}>
{t.cancel}
</button>
<button onClick={pv.sSave} style={{ height: "38px", padding: "0 16px", border: "0", borderRadius: "4px", background: "#0F5C4A", color: "#fff", cursor: "pointer" }}>
{t.saveChanges}
</button>
</>) : null}
</div>
</>) : null}
</div>
<div style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px", overflowX: "auto" }}>
<table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", minWidth: "640px" }}>
<thead>
<tr style={{ background: "#FAF9F6" }}>
<th style={{ textAlign: "start", padding: "10px 14px", fontWeight: "500", color: "#5C6168", fontSize: "12px", borderBottom: "1px solid #E3E1DA" }}>
{t.c_user}
</th>
{(pv.projects || []).map((p: any, __i: number) => (<Fragment key={__i}>
<th title={p.name} style={{ padding: "10px 6px", fontWeight: "500", color: "#5C6168", fontSize: "11.5px", borderBottom: "1px solid #E3E1DA", fontFamily: "'IBM Plex Mono',monospace" }}>
{p.code}
</th>
</Fragment>))}
</tr>
</thead>
<tbody>
<tr>
<td style={{ padding: "9px 14px", borderBottom: "1px solid #EFEDE7" }}>
<b>
{t.qmAll}
</b>
</td>
{(pv.projects || []).map((_p: any, __i: number) => (<Fragment key={__i}>
<td style={{ textAlign: "center", borderBottom: "1px solid #EFEDE7", color: "#5C6168", fontSize: "12px" }}>
{t.byRole}
</td>
</Fragment>))}
</tr>
{(pv.scopeRows || []).map((r: any, __i: number) => (<Fragment key={__i}>
<tr>
<td style={{ padding: "9px 14px", borderBottom: "1px solid #EFEDE7" }}>
<div style={{ fontWeight: "500" }}>
{r.name}
</div>
<div style={{ fontSize: "12px", color: "#8B9097" }}>
{r.role}
</div>
</td>
{(r.cells || []).map((c: any, __i: number) => (<Fragment key={__i}>
<td style={{ textAlign: "center", borderBottom: "1px solid #EFEDE7" }}>
<button onClick={c.toggle} style={{ width: "26px", height: "26px", borderRadius: "4px", border: `1.5px solid ${c.bd}`, background: c.bg, color: "#fff", fontWeight: "700", cursor: "pointer" }}>
{c.mark}
</button>
</td>
</Fragment>))}
</tr>
</Fragment>))}
</tbody>
</table>
</div>
</>) : null}
{pv.isConf ? (<>
<div style={{ fontSize: "13px", color: "#F1DCDB", background: "#1E1415", borderRadius: "4px", padding: "12px 14px" }}>
{t.gmNote}
</div>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
{(pv.grants || []).map((g: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "flex", gap: "10px 16px", alignItems: "center", padding: "12px 18px", borderBottom: "1px solid #F3F1EC", flexWrap: "wrap" }}>
<span style={{ flex: "1", minWidth: "200px" }}>
<span style={{ display: "block", fontWeight: "500" }}>
{g.who}
</span>
<span style={{ display: "block", fontSize: "12px", color: "#8B9097" }}>
{g.lv} · {g.scope} · {g.by} · {g.at}
</span>
</span>
<span style={{ fontSize: "12px", color: "#5C6168" }}>
{g.exp}
</span>
<span style={{ height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", color: g.st.fg, background: g.st.bg, display: "inline-flex", alignItems: "center" }}>
{g.st.label}
</span>
</div>
</Fragment>))}
</section>
<div style={{ fontSize: "12.5px", color: "#5C6168" }}>
{t.grantsManagedBy}
</div>
</>) : null}
</div>
</>);
}
