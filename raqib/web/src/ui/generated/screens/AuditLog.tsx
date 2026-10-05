/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import { Fragment } from "react";
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";
import { FONT } from "@/styles/typography";

export function AuditLog({ vm }: { vm: VM }) {
  const { arr, au, closeSheet, mobile, notMobile, pad, pageTitle, sheetOpen, t, toggleSheet } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "1360px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "14px" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "12px", flexWrap: "wrap" }}>
<div>
<h1 style={{ margin: "0", fontSize: "22px", fontWeight: "600" }}>
{pageTitle}
</h1>
<div style={{ fontSize: "13px", color: C.text.secondary }}>
{au.count}
</div>
</div>
<div style={{ display: "flex", gap: "8px" }}>
{mobile ? (<>
<button onClick={toggleSheet} style={{ height: "40px", padding: "0 14px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, cursor: "pointer" }}>
{t.filters}
</button>
</>) : null}
{au.canExport ? (<>
<button onClick={au.exportCsv} style={{ height: "40px", padding: "0 14px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, cursor: "pointer" }}>
{t.exportExcel}
</button>
</>) : null}
</div>
</div>
{notMobile ? (<>
<div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
<input value={au.q} onChange={au.onQ} placeholder={t.auditSearchPh} style={{ height: "38px", flex: "1", minWidth: "200px", maxWidth: "320px", border: `1px solid ${C.border.input}`, borderRadius: "4px", padding: "0 12px", fontSize: "14px" }} />
<select value={au.ent} onChange={au.onEnt} style={{ height: "38px", border: `1px solid ${C.border.input}`, borderRadius: "4px", padding: "0 10px", background: C.surface.white, fontSize: "13.5px" }}>
{(au.entOpts || []).map((o: any, __i: number) => (<Fragment key={__i}>
<option value={o.v}>
{o.l}
</option>
</Fragment>))}
</select>
<select value={au.who} onChange={au.onWho} style={{ height: "38px", border: `1px solid ${C.border.input}`, borderRadius: "4px", padding: "0 10px", background: C.surface.white, fontSize: "13.5px" }}>
{(au.whoOpts || []).map((o: any, __i: number) => (<Fragment key={__i}>
<option value={o.v}>
{o.l}
</option>
</Fragment>))}
</select>
<input type="date" value={au.from} onChange={au.onFrom} style={{ height: "38px", border: `1px solid ${C.border.input}`, borderRadius: "4px", padding: "0 8px", fontSize: "13px" }} />
<input type="date" value={au.to} onChange={au.onTo} style={{ height: "38px", border: `1px solid ${C.border.input}`, borderRadius: "4px", padding: "0 8px", fontSize: "13px" }} />
<button onClick={au.clear} style={{ background: "none", border: "0", color: C.brand.primary, fontSize: "13px", cursor: "pointer" }}>
{t.clearFilters}
</button>
</div>
</>) : null}
{sheetOpen ? (<>
<div onClick={closeSheet} style={{ position: "absolute", inset: "0", background: C.scrim.medium, zIndex: "30" }} aria-hidden="true"></div>
<div style={{ position: "absolute", insetInline: "0", bottom: "0", background: C.surface.white, borderRadius: "10px 10px 0 0", zIndex: "31", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
<div style={{ fontWeight: "600" }}>
{t.filters}
</div>
<input value={au.q} onChange={au.onQ} placeholder={t.auditSearchPh} style={{ height: "46px", border: `1px solid ${C.border.input}`, borderRadius: "4px", padding: "0 12px", fontSize: "15px" }} />
<select value={au.ent} onChange={au.onEnt} style={{ height: "46px", border: `1px solid ${C.border.input}`, borderRadius: "4px", padding: "0 10px", background: C.surface.white, fontSize: "15px" }}>
{(au.entOpts || []).map((o: any, __i: number) => (<Fragment key={__i}>
<option value={o.v}>
{o.l}
</option>
</Fragment>))}
</select>
<select value={au.who} onChange={au.onWho} style={{ height: "46px", border: `1px solid ${C.border.input}`, borderRadius: "4px", padding: "0 10px", background: C.surface.white, fontSize: "15px" }}>
{(au.whoOpts || []).map((o: any, __i: number) => (<Fragment key={__i}>
<option value={o.v}>
{o.l}
</option>
</Fragment>))}
</select>
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
<input type="date" value={au.from} onChange={au.onFrom} style={{ height: "46px", border: `1px solid ${C.border.input}`, borderRadius: "4px", padding: "0 8px" }} />
<input type="date" value={au.to} onChange={au.onTo} style={{ height: "46px", border: `1px solid ${C.border.input}`, borderRadius: "4px", padding: "0 8px" }} />
</div>
<div style={{ display: "flex", gap: "8px" }}>
<button onClick={au.clear} style={{ flex: "1", height: "46px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white }}>
{t.clearFilters}
</button>
<button onClick={closeSheet} style={{ flex: "1", height: "46px", border: "0", borderRadius: "4px", background: C.brand.primary, color: C.surface.white }}>
{t.showResults}
</button>
</div>
</div>
</>) : null}
{au.has ? (<>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px" }}>
{(au.rows || []).map((a: any, __i: number) => (<Fragment key={__i}>
<div style={{ padding: "11px 18px", borderBottom: `1px solid ${C.surface.track}`, display: "flex", flexDirection: "column", gap: "4px" }}>
<div style={{ display: "flex", gap: "8px 14px", flexWrap: "wrap", alignItems: "baseline" }}>
<span style={{ fontSize: "12px", color: C.text.muted, minWidth: "110px" }}>
{a.at}
</span>
<span style={{ fontWeight: "600", fontSize: "13.5px", color: a.c }}>
{a.act}
</span>
<span style={{ fontSize: "12px", color: C.text.secondary, background: C.surface.sunken, borderRadius: "3px", padding: "0 6px" }}>
{a.ent}
</span>
<span style={{ fontFamily: FONT.mono, fontSize: "12px" }}>
{a.ref}
</span>
</div>
<div style={{ display: "flex", gap: "6px 14px", flexWrap: "wrap", fontSize: "12.5px", color: C.text.body, paddingInlineStart: "124px" }}>
<span>
{a.who} · {a.role}
</span>
{a.hasChange ? (<>
<span>
<span style={{ color: C.text.muted }}>
{a.prev}
</span>
 {arr} 
<b>
{a.next}
</b>
</span>
</>) : null}
<span dir="ltr" style={{ fontFamily: FONT.mono, fontSize: "11.5px", color: C.text.muted }}>
{a.dev}
</span>
</div>
{a.hasReason ? (<>
<div style={{ fontSize: "12.5px", color: C.text.body, paddingInlineStart: "124px" }}>
{t.c_reason}: {a.reason}
</div>
</>) : null}
</div>
</Fragment>))}
</section>
</>) : null}
{au.none ? (<>
<div style={{ background: C.surface.white, border: `1px dashed ${C.border.input}`, borderRadius: "6px", padding: "36px", textAlign: "center", color: C.text.secondary }}>
{t.noResults}
</div>
</>) : null}
<div style={{ fontSize: "12px", color: C.text.secondary }}>
{au.note}
</div>
</div>
</>);
}
