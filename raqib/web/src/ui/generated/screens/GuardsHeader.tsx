/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";

export function GuardsHeader({ vm }: { vm: VM }) {
  const { gd, pad, t } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "1180px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
<div>
<h1 style={{ margin: "0", fontSize: "22px", fontWeight: "600" }}>
{t.nav_guards_h}
</h1>
<div style={{ fontSize: "13px", color: C.text.secondary }}>
{gd.count}
</div>
</div>
</div>
</>);
}
