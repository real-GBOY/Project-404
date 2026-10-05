/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";

export function LoadingSkeleton({ vm }: { vm: VM }) {
  const { pad } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "1360px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "12px" }}>
<div style={{ height: "28px", width: "240px", background: C.surface.sunkenDeep, borderRadius: "4px", animation: "rqpulse 1.2s infinite" }}></div>
<div style={{ height: "36px", width: "100%", background: C.surface.sunkenWarm, borderRadius: "4px", animation: "rqpulse 1.2s infinite" }}></div>
<div style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px", padding: "8px 0" }}>
<div style={{ height: "44px", margin: "6px 16px", background: C.surface.sunkenAlt, borderRadius: "3px", animation: "rqpulse 1.2s infinite" }}></div>
<div style={{ height: "44px", margin: "6px 16px", background: C.surface.sunkenAlt, borderRadius: "3px", animation: "rqpulse 1.2s infinite" }}></div>
<div style={{ height: "44px", margin: "6px 16px", background: C.surface.sunkenAlt, borderRadius: "3px", animation: "rqpulse 1.2s infinite" }}></div>
<div style={{ height: "44px", margin: "6px 16px", background: C.surface.sunkenAlt, borderRadius: "3px", animation: "rqpulse 1.2s infinite" }}></div>
</div>
</div>
</>);
}
