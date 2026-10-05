/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import { Fragment } from "react";
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";
import { FONT } from "@/styles/typography";

export function ReportsCenter({ vm }: { vm: VM }) {
  const { pad, pageTitle, rc, t } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "1360px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
<div>
<h1 style={{ margin: "0", fontSize: "22px", fontWeight: "600" }}>
{pageTitle}
</h1>
<div style={{ fontSize: "13px", color: C.text.secondary }}>
{rc.policy}
</div>
</div>
{rc.canGen ? (<>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px", padding: "16px 18px", display: "flex", flexDirection: "column", gap: "12px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600" }}>
{t.newReport}
</h2>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: "8px" }}>
{(rc.types || []).map((x: any, __i: number) => (<Fragment key={__i}>
<button onClick={x.go} style={{ textAlign: "start", border: `1.5px solid ${x.bd}`, background: x.bg, borderRadius: "4px", padding: "10px 12px", cursor: "pointer" }}>
<span style={{ display: "block", fontWeight: "600", fontSize: "13.5px" }}>
{x.label}
</span>
<span style={{ display: "block", fontSize: "12px", color: C.text.secondary }}>
{x.sub}
</span>
</button>
</Fragment>))}
</div>
<div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
<div style={{ display: "flex", border: `1px solid ${C.border.input}`, borderRadius: "4px", overflow: "hidden", flexWrap: "wrap" }}>
{(rc.pers || []).map((o: any, __i: number) => (<Fragment key={__i}>
<button onClick={o.set} style={{ border: "0", height: "36px", padding: "0 12px", fontSize: "13px", cursor: "pointer", background: o.bg, color: o.fg }}>
{o.label}
</button>
</Fragment>))}
</div>
<input type="date" value={rc.from} onChange={rc.onFrom} style={{ height: "36px", border: `1px solid ${C.border.input}`, borderRadius: "4px", padding: "0 8px" }} />
<span style={{ color: C.text.muted }}>
–
</span>
<input type="date" value={rc.to} onChange={rc.onTo} style={{ height: "36px", border: `1px solid ${C.border.input}`, borderRadius: "4px", padding: "0 8px" }} />
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: "8px" }}>
{rc.fP ? (<>
<label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", color: C.text.secondary }}>
{t.f_project}
<select value={rc.p} onChange={rc.onP} style={{ height: "38px", border: `1px solid ${C.border.input}`, borderRadius: "4px", padding: "0 8px", background: C.surface.white, fontSize: "13.5px", color: C.text.ink }}>
{(rc.pOpts || []).map((o: any, __i: number) => (<Fragment key={__i}>
<option value={o.v}>
{o.l}
</option>
</Fragment>))}
</select>
</label>
</>) : null}
{rc.fS ? (<>
<label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", color: C.text.secondary }}>
{t.f_site}
<select value={rc.s} onChange={rc.onS} style={{ height: "38px", border: `1px solid ${C.border.input}`, borderRadius: "4px", padding: "0 8px", background: C.surface.white, fontSize: "13.5px", color: C.text.ink }}>
{(rc.sOpts || []).map((o: any, __i: number) => (<Fragment key={__i}>
<option value={o.v}>
{o.l}
</option>
</Fragment>))}
</select>
</label>
</>) : null}
{rc.fIns ? (<>
<label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", color: C.text.secondary }}>
{t.f_inspector}
<select value={rc.ins} onChange={rc.onIns} style={{ height: "38px", border: `1px solid ${C.border.input}`, borderRadius: "4px", padding: "0 8px", background: C.surface.white, fontSize: "13.5px", color: C.text.ink }}>
{(rc.insOpts || []).map((o: any, __i: number) => (<Fragment key={__i}>
<option value={o.v}>
{o.l}
</option>
</Fragment>))}
</select>
</label>
</>) : null}
{rc.fG ? (<>
<label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", color: C.text.secondary }}>
{t.k_guard}
<select value={rc.g} onChange={rc.onG} style={{ height: "38px", border: `1px solid ${C.border.input}`, borderRadius: "4px", padding: "0 8px", background: C.surface.white, fontSize: "13.5px", color: C.text.ink }}>
{(rc.gOpts || []).map((o: any, __i: number) => (<Fragment key={__i}>
<option value={o.v}>
{o.l}
</option>
</Fragment>))}
</select>
</label>
</>) : null}
{rc.fSt ? (<>
<label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", color: C.text.secondary }}>
{t.c_st}
<select value={rc.st} onChange={rc.onSt} style={{ height: "38px", border: `1px solid ${C.border.input}`, borderRadius: "4px", padding: "0 8px", background: C.surface.white, fontSize: "13.5px", color: C.text.ink }}>
{(rc.stOpts || []).map((o: any, __i: number) => (<Fragment key={__i}>
<option value={o.v}>
{o.l}
</option>
</Fragment>))}
</select>
</label>
</>) : null}
{rc.fSev ? (<>
<label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", color: C.text.secondary }}>
{t.sev_label}
<select value={rc.sev} onChange={rc.onSev} style={{ height: "38px", border: `1px solid ${C.border.input}`, borderRadius: "4px", padding: "0 8px", background: C.surface.white, fontSize: "13.5px", color: C.text.ink }}>
{(rc.sevOpts || []).map((o: any, __i: number) => (<Fragment key={__i}>
<option value={o.v}>
{o.l}
</option>
</Fragment>))}
</select>
</label>
</>) : null}
{rc.fF ? (<>
<label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", color: C.text.secondary }}>
{t.f_form}
<select value={rc.f} onChange={rc.onF} style={{ height: "38px", border: `1px solid ${C.border.input}`, borderRadius: "4px", padding: "0 8px", background: C.surface.white, fontSize: "13.5px", color: C.text.ink }}>
{(rc.fOpts || []).map((o: any, __i: number) => (<Fragment key={__i}>
<option value={o.v}>
{o.l}
</option>
</Fragment>))}
</select>
</label>
</>) : null}
{rc.fV ? (<>
<label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", color: C.text.secondary }}>
{t.formVersion}
<select value={rc.fv} onChange={rc.onFv} style={{ height: "38px", border: `1px solid ${C.border.input}`, borderRadius: "4px", padding: "0 8px", background: C.surface.white, fontSize: "13.5px", color: C.text.ink }}>
{(rc.fvOpts || []).map((o: any, __i: number) => (<Fragment key={__i}>
<option value={o.v}>
{o.l}
</option>
</Fragment>))}
</select>
</label>
</>) : null}
</div>
<button onClick={rc.gen} style={{ alignSelf: "flex-start", height: "42px", padding: "0 18px", border: "0", borderRadius: "4px", background: C.brand.primary, color: C.surface.white, fontWeight: "500", cursor: "pointer" }}>
{t.generateReport}
</button>
</section>
</>) : null}
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 18px", borderBottom: `1px solid ${C.surface.track}` }}>
{t.generatedList}
</h2>
{(rc.jobs || []).map((j: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "flex", gap: "10px 14px", alignItems: "center", padding: "12px 18px", borderBottom: `1px solid ${C.surface.subtle}`, flexWrap: "wrap" }}>
<span style={{ flex: "1", minWidth: "220px" }}>
<span style={{ display: "block", fontWeight: "500" }}>
{j.type}
</span>
<span style={{ display: "block", fontSize: "12px", color: C.text.muted }}>
<span style={{ fontFamily: FONT.mono }}>
{j.ref}
</span>
 · {j.period} · {j.by} · {j.at}
</span>
</span>
{j.busy ? (<>
<span style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "160px", fontSize: "12px", color: C.status.info.fg }}>
{t.generating}
<span style={{ flex: "1", height: "4px", background: C.surface.track, borderRadius: "2px", overflow: "hidden", display: "block" }}>
<span style={{ display: "block", height: "100%", width: j.pW, background: C.status.info.fg }}></span>
</span>
</span>
</>) : null}
{j.ready ? (<>
<button onClick={j.go} style={{ height: "34px", padding: "0 12px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, cursor: "pointer", fontSize: "13px" }}>
{t.view}
</button>
<button onClick={j.pdf} style={{ height: "34px", padding: "0 12px", border: `1px solid ${C.brand.primary}`, color: C.brand.primary, borderRadius: "4px", background: C.surface.white, cursor: "pointer", fontSize: "13px" }}>
PDF
</button>
<button onClick={j.xls} style={{ height: "34px", padding: "0 12px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, cursor: "pointer", fontSize: "13px" }}>
Excel
</button>
</>) : null}
</div>
</Fragment>))}
</section>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 18px", borderBottom: `1px solid ${C.surface.track}` }}>
{t.generatedReports}
</h2>
{(rc.issued || []).map((r: any, __i: number) => (<Fragment key={__i}>
<button onClick={r.go} style={{ width: "100%", display: "flex", gap: "12px", alignItems: "center", padding: "12px 18px", border: "0", borderBottom: `1px solid ${C.surface.subtle}`, background: C.surface.white, cursor: "pointer", textAlign: "start", flexWrap: "wrap" }}>
<span style={{ flex: "1", minWidth: "220px" }}>
<span style={{ display: "block", fontWeight: "500" }}>
{r.proj} · {r.site}
</span>
<span style={{ display: "block", fontSize: "12px", color: C.text.muted }}>
<span style={{ fontFamily: FONT.mono }}>
{r.rref}
</span>
 · {r.ver} · {t.approvedOnShort} {r.approved}
</span>
</span>
<span style={{ fontWeight: "600", color: r.scoreC }}>
{r.score}
</span>
</button>
</Fragment>))}
</section>
</div>
</>);
}
