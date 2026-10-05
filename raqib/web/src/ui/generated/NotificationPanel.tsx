/* eslint-disable */
// GENERATED from the approved Claude Design (Raqib.dc.html) by tools/transpile — do not hand-edit.
import { Fragment } from "react";
import type { VM } from "@/ui/vm";

export function NotificationPanel({ vm }: { vm: VM }) {
  const { closeNotif, markAll, notifEmpty, notifW, notifs, t } = vm;
  return (<>
<div onClick={closeNotif} style={{ position: "absolute", inset: "0", background: "rgba(18,26,24,.25)", zIndex: "40" }} aria-hidden="true"></div>
<aside style={{ position: "absolute", top: "0", bottom: "0", insetInlineEnd: "0", width: notifW, background: "#fff", zIndex: "41", display: "flex", flexDirection: "column", boxShadow: "0 0 30px rgba(0,0,0,.15)" }}>
<div style={{ height: "58px", display: "flex", alignItems: "center", gap: "10px", padding: "0 18px", borderBottom: "1px solid #E3E1DA" }}>
<h2 style={{ margin: "0", fontSize: "16px", fontWeight: "600", flex: "1" }}>
{t.notifications}
</h2>
<button onClick={markAll} style={{ background: "none", border: "0", color: "#0F5C4A", fontSize: "13px", cursor: "pointer" }}>
{t.markAllRead}
</button>
<button onClick={closeNotif} style={{ height: "36px", minWidth: "36px", border: "1px solid #D6D3CB", borderRadius: "4px", background: "#fff", cursor: "pointer" }}>
✕
</button>
</div>
<div style={{ flex: "1", overflowY: "auto" }}>
{(notifs || []).map((n: any, __i: number) => (<Fragment key={__i}>
<button onClick={n.go} style={{ width: "100%", display: "flex", gap: "12px", padding: "14px 18px", border: "0", borderBottom: "1px solid #F3F1EC", background: n.bg, cursor: "pointer", textAlign: "start" }}>
<span style={{ width: "8px", height: "8px", borderRadius: "50%", background: n.dot, marginTop: "7px", flexShrink: "0" }}></span>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13.5px", fontWeight: "500" }}>
{n.t}
</span>
<span style={{ display: "block", fontSize: "12.5px", color: "#5C6168" }}>
{n.sub}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#8B9097", marginTop: "2px" }}>
{n.at}
</span>
</span>
</button>
</Fragment>))}
{notifEmpty ? (<>
<div style={{ padding: "40px 20px", textAlign: "center", color: "#5C6168" }}>
{t.noNotifs}
</div>
</>) : null}
</div>
</aside>
</>);
}
