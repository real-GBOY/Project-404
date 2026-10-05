/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import { Fragment } from "react";
import { Hover } from "@/components/Hover";
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";
import { FONT } from "@/styles/typography";

export function OverviewInspector({ vm }: { vm: VM }) {
  const { arr, ins, insHead, pad, t, todayLong } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "880px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" }}>
<div>
<div style={{ fontSize: "13px", color: C.text.secondary }}>
{todayLong}
</div>
<h1 style={{ margin: "2px 0 0", fontSize: "22px", fontWeight: "600" }}>
{insHead}
</h1>
</div>
{ins.hasRet ? (<>
{(ins.ret || []).map((v: any, __i: number) => (<Fragment key={__i}>
<div style={{ background: C.status.warning.bg, border: `1px solid ${C.status.warning.border}`, borderRadius: "6px", padding: "14px 16px", display: "flex", gap: "12px 16px", alignItems: "center", flexWrap: "wrap" }}>
<div style={{ flex: "1", minWidth: "220px" }}>
<div style={{ fontWeight: "600", color: C.status.warning.strong }}>
{t.returnedToYou}
</div>
<div style={{ fontSize: "13px", color: C.status.warning.strong }}>
<span style={{ fontFamily: FONT.mono }}>
{v.ref}
</span>
 · {v.site} · {v.by}
</div>
<div style={{ fontSize: "13.5px", color: C.status.warning.deep, marginTop: "6px" }}>
{v.reason}
</div>
</div>
<button onClick={v.primary} style={{ height: "44px", padding: "0 18px", border: "0", borderRadius: "4px", background: C.status.warning.fg, color: C.surface.white, fontWeight: "500", cursor: "pointer" }}>
{t.openToFix}
</button>
</div>
</Fragment>))}
</>) : null}
<section style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600" }}>
{t.todayVisits}
</h2>
{(ins.today || []).map((v: any, __i: number) => (<Fragment key={__i}>
<div style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
<div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
<div dir="ltr" style={{ fontFamily: FONT.mono, fontSize: "20px", fontWeight: "500", lineHeight: "1.2" }}>
{v.time}
</div>
<div style={{ flex: "1", minWidth: "0" }}>
<div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
<span style={{ fontFamily: FONT.mono, fontSize: "12px", color: C.text.secondary }}>
{v.ref}
</span>
<span style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", fontWeight: "500", color: v.st.fg, background: v.st.bg }}>
{v.st.label}
</span>
</div>
<div style={{ fontSize: "15.5px", fontWeight: "600", marginTop: "2px" }}>
{v.site} — {v.area}
</div>
<div style={{ fontSize: "13px", color: C.text.secondary }}>
{v.proj} · {v.shift} · {v.type}
</div>
{v.hasProgress ? (<>
<div style={{ fontSize: "12px", color: C.status.info.fg, marginTop: "4px" }}>
{v.progress}
</div>
</>) : null}
</div>
</div>
<div style={{ display: "flex", gap: "8px" }}>
<button onClick={v.primary} style={{ flex: "1", height: "48px", border: "0", borderRadius: "4px", background: C.brand.primary, color: C.surface.white, fontSize: "15px", fontWeight: "500", cursor: "pointer" }}>
{v.primaryLabel}
</button>
<button onClick={v.go} style={{ height: "48px", padding: "0 16px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, cursor: "pointer" }}>
{t.details}
</button>
</div>
</div>
</Fragment>))}
{ins.noToday ? (<>
<div style={{ background: C.surface.white, border: `1px dashed ${C.border.input}`, borderRadius: "6px", padding: "24px", textAlign: "center", color: C.text.secondary }}>
{t.noVisitsToday}
</div>
</>) : null}
</section>
{ins.hasUp ? (<>
<section style={{ display: "flex", flexDirection: "column", gap: "0", background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 16px", borderBottom: `1px solid ${C.surface.track}` }}>
{t.upcoming}
</h2>
{(ins.up || []).map((v: any, __i: number) => (<Fragment key={__i}>
<Hover as="button" onClick={v.go} style={{ display: "flex", gap: "14px", alignItems: "center", padding: "12px 16px", border: "0", borderBottom: `1px solid ${C.surface.subtle}`, background: C.surface.white, cursor: "pointer", textAlign: "start", minHeight: "56px" }} hover={{ background: C.surface.paper }}>
<span style={{ minWidth: "64px", lineHeight: "1.25" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600" }}>
{v.wd} {v.date}
</span>
<span dir="ltr" style={{ display: "block", fontFamily: FONT.mono, fontSize: "12px", color: C.text.secondary }}>
{v.time}
</span>
</span>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "14px", fontWeight: "500" }}>
{v.site} — {v.area}
</span>
<span style={{ display: "block", fontSize: "12px", color: C.text.muted }}>
{v.ref} · {v.type}
</span>
</span>
<span style={{ color: C.text.muted }}>
{arr}
</span>
</Hover>
</Fragment>))}
</section>
</>) : null}
{ins.hasRec ? (<>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 16px", borderBottom: `1px solid ${C.surface.track}` }}>
{t.mySubmitted}
</h2>
{(ins.rec || []).map((v: any, __i: number) => (<Fragment key={__i}>
<Hover as="button" onClick={v.go} style={{ width: "100%", display: "flex", gap: "12px", alignItems: "center", padding: "12px 16px", border: "0", borderBottom: `1px solid ${C.surface.subtle}`, background: C.surface.white, cursor: "pointer", textAlign: "start", minHeight: "56px" }} hover={{ background: C.surface.paper }}>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "14px", fontWeight: "500" }}>
{v.site} — {v.area}
</span>
<span style={{ display: "block", fontSize: "12px", color: C.text.muted }}>
<span style={{ fontFamily: FONT.mono }}>
{v.ref}
</span>
 · {v.date}
</span>
</span>
<span style={{ fontWeight: "600", color: v.scoreC, fontVariantNumeric: "tabular-nums" }}>
{v.score}
</span>
<span style={{ height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", fontWeight: "500", color: v.st.fg, background: v.st.bg, display: "inline-flex", alignItems: "center", whiteSpace: "nowrap" }}>
{v.st.label}
</span>
</Hover>
</Fragment>))}
</section>
</>) : null}
</div>
</>);
}
