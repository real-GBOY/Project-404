/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import { Fragment } from "react";
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";

export function BottomNav({ vm }: { vm: VM }) {
  const { bottomNav, hasMore, moreFg, openMore, t } = vm;
  return (<>
<nav style={{ flexShrink: "0", height: "62px", background: C.surface.white, borderTop: `1px solid ${C.border.hairline}`, display: "flex" }}>
{(bottomNav || []).map((it: any, __i: number) => (<Fragment key={__i}>
<button onClick={it.go} style={{ flex: "1", minWidth: "0", border: "0", borderTop: `2px solid ${it.mbar}`, background: C.surface.white, color: it.mfg, fontSize: "11.5px", cursor: "pointer", padding: "6px 4px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px", lineHeight: "1.25" }}>
<span style={{ textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: "2", WebkitBoxOrient: "vertical" }}>
{it.label}
</span>
{it.hasCount ? (<>
<span style={{ minWidth: "18px", height: "16px", padding: "0 5px", borderRadius: "8px", background: it.countBg, color: C.surface.white, fontSize: "10px" }}>
{it.count}
</span>
</>) : null}
</button>
</Fragment>))}
{hasMore ? (<>
<button onClick={openMore} style={{ flex: "1", border: "0", background: C.surface.white, color: moreFg, fontSize: "11.5px", cursor: "pointer" }}>
{t.more}
</button>
</>) : null}
</nav>
</>);
}
