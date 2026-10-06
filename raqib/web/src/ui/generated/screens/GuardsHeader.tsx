/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";

export function GuardsHeader({ vm }: { vm: VM }) {
  const { gd, pad, t } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "1180px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
<div style={{ display: "flex", gap: "12px", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
<div>
<h1 style={{ margin: "0", fontSize: "22px", fontWeight: "600" }}>
{t.nav_guards_h}
</h1>
<div style={{ fontSize: "13px", color: C.text.secondary }}>
{gd.count}
</div>
</div>
{gd.canManage ? (<>
<button onClick={gd.add} style={{ height: "40px", padding: "0 16px", border: "0", borderRadius: "4px", background: C.brand.primary, color: C.surface.white, fontWeight: "500", cursor: "pointer" }}>
{t.pa_addGuard}
</button>
</>) : null}
</div>
</div>
</>);
}
