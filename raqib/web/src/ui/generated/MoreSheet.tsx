/* eslint-disable */
// GENERATED from the approved Claude Design (Raqib.dc.html) by tools/transpile — do not hand-edit.
import { Fragment } from "react";
import type { VM } from "@/ui/vm";

export function MoreSheet({ vm }: { vm: VM }) {
  const { closeMore, moreItems } = vm;
  return (<>
<div onClick={closeMore} style={{ position: "absolute", inset: "0", background: "rgba(18,26,24,.4)", zIndex: "30" }} aria-hidden="true"></div>
<div style={{ position: "absolute", insetInline: "0", bottom: "62px", background: "#fff", borderRadius: "10px 10px 0 0", zIndex: "31", padding: "8px 0", maxHeight: "70%", overflowY: "auto" }}>
{(moreItems || []).map((it: any, __i: number) => (<Fragment key={__i}>
<button onClick={it.go} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 20px", height: "52px", border: "0", borderBottom: "1px solid #F3F1EC", background: "#fff", color: it.mfg, fontSize: "15px", cursor: "pointer", textAlign: "start" }}>
<span>
{it.label}
</span>
{it.hasCount ? (<>
<span style={{ minWidth: "22px", height: "20px", padding: "0 6px", borderRadius: "10px", background: it.countBg, color: "#fff", fontSize: "11px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
{it.count}
</span>
</>) : null}
</button>
</Fragment>))}
</div>
</>);
}
