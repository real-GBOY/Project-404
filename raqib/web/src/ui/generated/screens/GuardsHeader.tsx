/* eslint-disable */
// GENERATED from the approved Claude Design (Raqib.dc.html) by tools/transpile — do not hand-edit.
import type { VM } from "@/ui/vm";

export function GuardsHeader({ vm }: { vm: VM }) {
  const { gd, pad, t } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "1180px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
<div>
<h1 style={{ margin: "0", fontSize: "22px", fontWeight: "600" }}>
{t.nav_guards_h}
</h1>
<div style={{ fontSize: "13px", color: "#5C6168" }}>
{gd.count}
</div>
</div>
</div>
</>);
}
