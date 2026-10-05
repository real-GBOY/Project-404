/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import { Fragment } from "react";
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";
import { FONT } from "@/styles/typography";

export function ReportsIssued({ vm }: { vm: VM }) {
  const { pad, rl, t } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "1240px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
<div>
<h1 style={{ margin: "0", fontSize: "22px", fontWeight: "600" }}>
{t.nav_reports_l}
</h1>
<div style={{ fontSize: "13px", color: C.text.secondary }}>
{t.reportsSub}
</div>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: "8px" }}>
{(rl.types || []).map((x: any, __i: number) => (<Fragment key={__i}>
<div style={{ border: `1px solid ${x.bd}`, background: x.bg, borderRadius: "4px", padding: "12px 14px" }}>
<div style={{ fontWeight: "600", fontSize: "13.5px" }}>
{x.label}
</div>
<div style={{ fontSize: "12px", color: C.text.secondary }}>
{x.sub}
</div>
</div>
</Fragment>))}
</div>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 18px", borderBottom: `1px solid ${C.surface.track}` }}>
{t.generatedReports}
</h2>
{(rl.rows || []).map((r: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "flex", gap: "12px", alignItems: "center", padding: "12px 18px", borderBottom: `1px solid ${C.surface.subtle}`, flexWrap: "wrap" }}>
<span style={{ flex: "1", minWidth: "220px" }}>
<span style={{ display: "block", fontWeight: "500" }}>
{r.proj} · {r.site}
</span>
<span style={{ display: "block", fontSize: "12px", color: C.text.muted }}>
<span style={{ fontFamily: FONT.mono }}>
{r.rref}
</span>
 · {r.ref} · {t.approvedOnShort} {r.approved}
</span>
</span>
<span style={{ fontWeight: "600", color: r.scoreC }}>
{r.score}
</span>
<button onClick={r.go} style={{ height: "34px", padding: "0 12px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, cursor: "pointer", fontSize: "13px" }}>
{t.view}
</button>
<button onClick={r.dl} style={{ height: "34px", padding: "0 12px", border: `1px solid ${C.brand.primary}`, color: C.brand.primary, borderRadius: "4px", background: C.surface.white, cursor: "pointer", fontSize: "13px" }}>
PDF
</button>
</div>
</Fragment>))}
{rl.none ? (<>
<div style={{ padding: "24px", textAlign: "center", color: C.text.secondary }}>
{t.noReports}
</div>
</>) : null}
</section>
</div>
</>);
}
