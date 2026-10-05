/* eslint-disable */
// GENERATED from the approved Claude Design (Raqib.dc.html) by tools/transpile — do not hand-edit.
import { Fragment } from "react";
import { Hover } from "@/ui/Hover";
import type { VM } from "@/ui/vm";

export function Sidebar({ vm }: { vm: VM }) {
  const { meIni, meName, meScope, meTitle, navGroups, sideW, t } = vm;
  return (<>
<aside style={{ width: sideW, flexShrink: "0", background: "#121A18", color: "#C9D1CE", display: "flex", flexDirection: "column", overflowY: "auto" }}>
<div style={{ padding: "18px 20px 14px", display: "flex", alignItems: "center", gap: "10px" }}>
<div style={{ width: "30px", height: "30px", background: "#0F5C4A", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: "700", fontSize: "15px" }}>
{t.logoMark}
</div>
<div style={{ display: "flex", flexDirection: "column", lineHeight: "1.2" }}>
<span style={{ fontWeight: "600", color: "#fff", fontSize: "16px" }}>
{t.brand}
</span>
<span style={{ fontSize: "11px", color: "#7D8A85" }}>
{t.brandSub}
</span>
</div>
</div>
{(navGroups || []).map((g: any, __i: number) => (<Fragment key={__i}>
<div style={{ padding: "14px 20px 6px", fontSize: "11px", color: "#6F7B77", letterSpacing: ".03em", display: "flex", alignItems: "center", gap: "8px" }}>
<span>
{g.label}
</span>
{g.restricted ? (<>
<span style={{ border: "1px solid #6B3B3D", color: "#E2A9A6", borderRadius: "2px", padding: "0 5px", fontSize: "10px" }}>
{t.restrictedTag}
</span>
</>) : null}
</div>
{(g.items || []).map((it: any, __i: number) => (<Fragment key={__i}>
<Hover as="button" onClick={it.go} style={{ width: "100%", display: "flex", alignItems: "center", gap: "8px", textAlign: "start", border: "0", borderInlineStart: `2px solid ${it.bar}`, background: it.bg, color: it.fg, padding: "8px 18px", fontSize: "13.5px", cursor: "pointer", minHeight: "36px" }} hover={{ background: "#1A2421" }}>
<span style={{ flex: "1" }}>
{it.label}
</span>
{it.hasCount ? (<>
<span style={{ minWidth: "20px", height: "18px", padding: "0 6px", borderRadius: "9px", background: it.countBg, color: "#fff", fontSize: "11px", display: "inline-flex", alignItems: "center", justifyContent: "center", fontVariantNumeric: "tabular-nums" }}>
{it.count}
</span>
</>) : null}
</Hover>
</Fragment>))}
</Fragment>))}
<div style={{ marginTop: "auto", padding: "14px 18px", borderTop: "1px solid #1F2B28", display: "flex", gap: "10px", alignItems: "center" }}>
<div style={{ width: "34px", height: "34px", borderRadius: "50%", background: "#26332F", color: "#E8EEEB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "600", flexShrink: "0" }}>
{meIni}
</div>
<div style={{ minWidth: "0", lineHeight: "1.35" }}>
<div style={{ color: "#fff", fontSize: "13px", fontWeight: "500", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{meName}
</div>
<div style={{ fontSize: "11px", color: "#7D8A85" }}>
{meTitle}
</div>
<div style={{ fontSize: "11px", color: "#7D8A85", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{meScope}
</div>
</div>
</div>
</aside>
</>);
}
