/* eslint-disable */
// GENERATED from the approved Claude Design (Raqib.dc.html) by tools/transpile — do not hand-edit.
import { Fragment } from "react";
import type { VM } from "@/ui/vm";

export function AuditLog({ vm }: { vm: VM }) {
  const { arr, au, closeSheet, mobile, notMobile, pad, pageTitle, sheetOpen, t, toggleSheet } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "1360px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "14px" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "12px", flexWrap: "wrap" }}>
<div>
<h1 style={{ margin: "0", fontSize: "22px", fontWeight: "600" }}>
{pageTitle}
</h1>
<div style={{ fontSize: "13px", color: "#5C6168" }}>
{au.count}
</div>
</div>
<div style={{ display: "flex", gap: "8px" }}>
{mobile ? (<>
<button onClick={toggleSheet} style={{ height: "40px", padding: "0 14px", border: "1px solid #D6D3CB", borderRadius: "4px", background: "#fff", cursor: "pointer" }}>
{t.filters}
</button>
</>) : null}
{au.canExport ? (<>
<button onClick={au.exportCsv} style={{ height: "40px", padding: "0 14px", border: "1px solid #D6D3CB", borderRadius: "4px", background: "#fff", cursor: "pointer" }}>
{t.exportExcel}
</button>
</>) : null}
</div>
</div>
{notMobile ? (<>
<div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
<input value={au.q} onChange={au.onQ} placeholder={t.auditSearchPh} style={{ height: "38px", flex: "1", minWidth: "200px", maxWidth: "320px", border: "1px solid #D6D3CB", borderRadius: "4px", padding: "0 12px", fontSize: "14px" }} />
<select value={au.ent} onChange={au.onEnt} style={{ height: "38px", border: "1px solid #D6D3CB", borderRadius: "4px", padding: "0 10px", background: "#fff", fontSize: "13.5px" }}>
{(au.entOpts || []).map((o: any, __i: number) => (<Fragment key={__i}>
<option value={o.v}>
{o.l}
</option>
</Fragment>))}
</select>
<select value={au.who} onChange={au.onWho} style={{ height: "38px", border: "1px solid #D6D3CB", borderRadius: "4px", padding: "0 10px", background: "#fff", fontSize: "13.5px" }}>
{(au.whoOpts || []).map((o: any, __i: number) => (<Fragment key={__i}>
<option value={o.v}>
{o.l}
</option>
</Fragment>))}
</select>
<input type="date" value={au.from} onChange={au.onFrom} style={{ height: "38px", border: "1px solid #D6D3CB", borderRadius: "4px", padding: "0 8px", fontSize: "13px" }} />
<input type="date" value={au.to} onChange={au.onTo} style={{ height: "38px", border: "1px solid #D6D3CB", borderRadius: "4px", padding: "0 8px", fontSize: "13px" }} />
<button onClick={au.clear} style={{ background: "none", border: "0", color: "#0F5C4A", fontSize: "13px", cursor: "pointer" }}>
{t.clearFilters}
</button>
</div>
</>) : null}
{sheetOpen ? (<>
<div onClick={closeSheet} style={{ position: "absolute", inset: "0", background: "rgba(18,26,24,.4)", zIndex: "30" }} aria-hidden="true"></div>
<div style={{ position: "absolute", insetInline: "0", bottom: "0", background: "#fff", borderRadius: "10px 10px 0 0", zIndex: "31", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
<div style={{ fontWeight: "600" }}>
{t.filters}
</div>
<input value={au.q} onChange={au.onQ} placeholder={t.auditSearchPh} style={{ height: "46px", border: "1px solid #D6D3CB", borderRadius: "4px", padding: "0 12px", fontSize: "15px" }} />
<select value={au.ent} onChange={au.onEnt} style={{ height: "46px", border: "1px solid #D6D3CB", borderRadius: "4px", padding: "0 10px", background: "#fff", fontSize: "15px" }}>
{(au.entOpts || []).map((o: any, __i: number) => (<Fragment key={__i}>
<option value={o.v}>
{o.l}
</option>
</Fragment>))}
</select>
<select value={au.who} onChange={au.onWho} style={{ height: "46px", border: "1px solid #D6D3CB", borderRadius: "4px", padding: "0 10px", background: "#fff", fontSize: "15px" }}>
{(au.whoOpts || []).map((o: any, __i: number) => (<Fragment key={__i}>
<option value={o.v}>
{o.l}
</option>
</Fragment>))}
</select>
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
<input type="date" value={au.from} onChange={au.onFrom} style={{ height: "46px", border: "1px solid #D6D3CB", borderRadius: "4px", padding: "0 8px" }} />
<input type="date" value={au.to} onChange={au.onTo} style={{ height: "46px", border: "1px solid #D6D3CB", borderRadius: "4px", padding: "0 8px" }} />
</div>
<div style={{ display: "flex", gap: "8px" }}>
<button onClick={au.clear} style={{ flex: "1", height: "46px", border: "1px solid #D6D3CB", borderRadius: "4px", background: "#fff" }}>
{t.clearFilters}
</button>
<button onClick={closeSheet} style={{ flex: "1", height: "46px", border: "0", borderRadius: "4px", background: "#0F5C4A", color: "#fff" }}>
{t.showResults}
</button>
</div>
</div>
</>) : null}
{au.has ? (<>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
{(au.rows || []).map((a: any, __i: number) => (<Fragment key={__i}>
<div style={{ padding: "11px 18px", borderBottom: "1px solid #EFEDE7", display: "flex", flexDirection: "column", gap: "4px" }}>
<div style={{ display: "flex", gap: "8px 14px", flexWrap: "wrap", alignItems: "baseline" }}>
<span style={{ fontSize: "12px", color: "#8B9097", minWidth: "110px" }}>
{a.at}
</span>
<span style={{ fontWeight: "600", fontSize: "13.5px", color: a.c }}>
{a.act}
</span>
<span style={{ fontSize: "12px", color: "#5C6168", background: "#ECEAE5", borderRadius: "3px", padding: "0 6px" }}>
{a.ent}
</span>
<span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px" }}>
{a.ref}
</span>
</div>
<div style={{ display: "flex", gap: "6px 14px", flexWrap: "wrap", fontSize: "12.5px", color: "#3D4247", paddingInlineStart: "124px" }}>
<span>
{a.who} · {a.role}
</span>
{a.hasChange ? (<>
<span>
<span style={{ color: "#8B9097" }}>
{a.prev}
</span>
 {arr} 
<b>
{a.next}
</b>
</span>
</>) : null}
<span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "11.5px", color: "#8B9097" }}>
{a.dev}
</span>
</div>
{a.hasReason ? (<>
<div style={{ fontSize: "12.5px", color: "#3D4247", paddingInlineStart: "124px" }}>
{t.c_reason}: {a.reason}
</div>
</>) : null}
</div>
</Fragment>))}
</section>
</>) : null}
{au.none ? (<>
<div style={{ background: "#fff", border: "1px dashed #D6D3CB", borderRadius: "6px", padding: "36px", textAlign: "center", color: "#5C6168" }}>
{t.noResults}
</div>
</>) : null}
<div style={{ fontSize: "12px", color: "#5C6168" }}>
{au.note}
</div>
</div>
</>);
}
