/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import { Fragment } from "react";
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";
import { FONT } from "@/styles/typography";

export function SettingsScreen({ vm }: { vm: VM }) {
  const { mobile, notMobile, pad, pageTitle, setCols, sv, t } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "1240px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
<div>
<h1 style={{ margin: "0", fontSize: "22px", fontWeight: "600" }}>
{pageTitle}
</h1>
<div style={{ fontSize: "13px", color: C.text.secondary }}>
{t.settingsSub}
</div>
</div>
{mobile ? (<>
<select value={sv.tab} onChange={sv.onTab} style={{ height: "46px", border: `1px solid ${C.border.input}`, borderRadius: "4px", padding: "0 10px", background: C.surface.white, fontSize: "15px" }}>
{(sv.navOpts || []).map((o: any, __i: number) => (<Fragment key={__i}>
<option value={o.v}>
{o.l}
</option>
</Fragment>))}
</select>
</>) : null}
<div style={{ display: "grid", gridTemplateColumns: setCols, gap: "20px", alignItems: "start" }}>
{notMobile ? (<>
<nav style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px", padding: "6px", position: "sticky", top: "16px" }}>
{(sv.nav || []).map((n: any, __i: number) => (<Fragment key={__i}>
<button onClick={n.go} style={{ width: "100%", display: "flex", justifyContent: "space-between", padding: "9px 12px", border: "0", borderRadius: "4px", background: n.bg, color: n.fg, cursor: "pointer", textAlign: "start", fontSize: "13.5px" }}>
<span>
{n.label}
</span>
<span style={{ color: C.text.muted }}>
{n.arr}
</span>
</button>
</Fragment>))}
</nav>
</>) : null}
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px" }}>
<div style={{ padding: "16px 18px", borderBottom: `1px solid ${C.surface.track}` }}>
<h2 style={{ margin: "0", fontSize: "16px", fontWeight: "600" }}>
{sv.title}
</h2>
<div style={{ fontSize: "12.5px", color: C.text.secondary }}>
{sv.desc}
</div>
</div>
{sv.ro ? (<>
<div style={{ margin: "12px 18px 0", fontSize: "12.5px", color: C.text.secondary, background: C.surface.paper, borderRadius: "4px", padding: "8px 10px" }}>
{sv.roTxt}
</div>
</>) : null}
{sv.isProjects ? (<>
{(sv.projects || []).map((p: any, __i: number) => (<Fragment key={__i}>
<button onClick={p.go} style={{ width: "100%", display: "flex", gap: "12px", alignItems: "center", padding: "12px 18px", border: "0", borderBottom: `1px solid ${C.surface.subtle}`, background: C.surface.white, cursor: "pointer", textAlign: "start", flexWrap: "wrap" }}>
<span style={{ flex: "1", minWidth: "200px" }}>
<span style={{ display: "block", fontWeight: "500" }}>
{p.name}
</span>
<span style={{ display: "block", fontSize: "12px", color: C.text.muted }}>
<span style={{ fontFamily: FONT.mono }}>
{p.code}
</span>
 · {p.sites} · {p.mgr}
</span>
</span>
<span style={{ height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", color: p.st.fg, background: p.st.bg, display: "inline-flex", alignItems: "center" }}>
{p.st.label}
</span>
</button>
</Fragment>))}
</>) : null}
{(sv.fields || []).map((f: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "flex", gap: "10px 20px", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderBottom: `1px solid ${C.surface.subtle}`, flexWrap: "wrap" }}>
<div style={{ flex: "1", minWidth: "200px" }}>
<div style={{ fontSize: "13.5px", fontWeight: "500" }}>
{f.label}
</div>
{f.hasHelp ? (<>
<div style={{ fontSize: "12px", color: C.text.muted }}>
{f.help}
</div>
</>) : null}
</div>
{f.isText ? (<>
<input value={f.val} onChange={f.onText} readOnly={f.ro} style={{ height: "38px", minWidth: "240px", border: `1px solid ${C.border.input}`, borderRadius: "4px", padding: "0 10px", fontSize: "14px" }} />
</>) : null}
{f.isNum ? (<>
<span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
<input type="number" value={f.val} onChange={f.onText} readOnly={f.ro} style={{ height: "38px", width: "96px", border: `1px solid ${C.border.input}`, borderRadius: "4px", padding: "0 10px", fontSize: "14px" }} />
<span style={{ fontSize: "12.5px", color: C.text.secondary }}>
{f.unit}
</span>
</span>
</>) : null}
{f.isSel ? (<>
<select value={f.val} onChange={f.onText} disabled={f.ro} style={{ height: "38px", minWidth: "180px", border: `1px solid ${C.border.input}`, borderRadius: "4px", padding: "0 8px", background: C.surface.white, fontSize: "14px" }}>
{(f.opts || []).map((o: any, __i: number) => (<Fragment key={__i}>
<option value={o.v}>
{o.l}
</option>
</Fragment>))}
</select>
</>) : null}
{f.isTog ? (<>
<button onClick={f.toggle} style={{ width: "46px", height: "26px", borderRadius: "13px", border: "0", background: f.tbg, padding: "3px", display: "flex", justifyContent: f.tpos, cursor: "pointer" }}>
<span style={{ width: "20px", height: "20px", borderRadius: "50%", background: C.surface.white, display: "block" }}></span>
</button>
</>) : null}
{f.isInfo ? (<>
<span style={{ fontSize: "13.5px", color: C.text.body }}>
{f.val}
</span>
</>) : null}
{f.isPair ? (<>
<span style={{ display: "flex", gap: "14px" }}>
{(f.pair || []).map((p: any, __i: number) => (<Fragment key={__i}>
<span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", color: C.text.secondary }}>
{p.l}
<button onClick={p.toggle} style={{ width: "40px", height: "22px", borderRadius: "11px", border: "0", background: p.bg, padding: "3px", display: "flex", justifyContent: p.pos, cursor: "pointer" }}>
<span style={{ width: "16px", height: "16px", borderRadius: "50%", background: C.surface.white, display: "block" }}></span>
</button>
</span>
</Fragment>))}
</span>
</>) : null}
{f.isChips ? (<>
<span style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
{(f.chips || []).map((c: any, __i: number) => (<Fragment key={__i}>
<button onClick={c.toggle} style={{ height: "30px", padding: "0 10px", border: `1px solid ${C.border.input}`, borderRadius: "15px", background: c.bg, color: c.fg, fontSize: "12px", cursor: "pointer" }}>
{c.l}
</button>
</Fragment>))}
</span>
</>) : null}
</div>
</Fragment>))}
{sv.dirty ? (<>
<div style={{ position: "sticky", bottom: "0", background: C.surface.paper, borderTop: `1px solid ${C.border.hairline}`, padding: "12px 18px", display: "flex", gap: "8px", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" }}>
<span style={{ fontSize: "12.5px", color: C.status.warning.fg, marginInlineEnd: "auto" }}>
{t.unsaved} · {sv.nDiff}
</span>
<button onClick={sv.discard} style={{ height: "38px", padding: "0 14px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, cursor: "pointer" }}>
{t.discardChanges}
</button>
<button onClick={sv.save} style={{ height: "38px", padding: "0 16px", border: "0", borderRadius: "4px", background: C.brand.primary, color: C.surface.white, cursor: "pointer" }}>
{t.saveChanges}
</button>
</div>
</>) : null}
</section>
</div>
</div>
</>);
}
