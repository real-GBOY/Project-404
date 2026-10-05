/* eslint-disable */
// GENERATED from the approved Claude Design (Raqib.dc.html) by tools/transpile — do not hand-edit.
import type { VM } from "@/ui/vm";

export function ModuleStub({ vm }: { vm: VM }) {
  const { pad, stub } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "720px", margin: "24px auto" }}>
<section style={{ background: "#fff", border: "1px dashed #C9C6BE", borderRadius: "6px", padding: "28px", display: "flex", flexDirection: "column", gap: "8px" }}>
<h1 style={{ margin: "0", fontSize: "20px", fontWeight: "600" }}>
{stub.title}
</h1>
<div style={{ fontSize: "14px", color: "#3D4247" }}>
{stub.body}
</div>
<div style={{ fontSize: "12px", color: "#8B9097", marginTop: "6px" }}>
{stub.phase}
</div>
</section>
</div>
</>);
}
