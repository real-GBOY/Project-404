/* eslint-disable */
// GENERATED from the approved Claude Design (Raqib.dc.html) by tools/transpile — do not hand-edit.
import type { VM } from "@/ui/vm";

export function TopBar({ vm }: { vm: VM }) {
  const { canSearch, hasUnread, hpad, mobile, notMobile, openSearch, pageSub, pageTitle, t, toggleNotif, unread } = vm;
  return (<>
<header style={{ height: "58px", flexShrink: "0", background: "#fff", borderBottom: "1px solid #E3E1DA", display: "flex", alignItems: "center", gap: "12px", padding: `0 ${hpad}` }}>
{mobile ? (<>
<div style={{ width: "30px", height: "30px", background: "#0F5C4A", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: "700", fontSize: "15px", flexShrink: "0" }}>
{t.logoMark}
</div>
</>) : null}
<div style={{ flex: "1", minWidth: "0", lineHeight: "1.3" }}>
<div style={{ fontSize: "15px", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{pageTitle}
</div>
<div style={{ fontSize: "12px", color: "#8B9097", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{pageSub}
</div>
</div>
{canSearch ? (<>
{notMobile ? (<>
<button onClick={openSearch} style={{ height: "36px", width: "300px", display: "flex", alignItems: "center", gap: "10px", padding: "0 12px", border: "1px solid #D6D3CB", borderRadius: "4px", background: "#FAF9F6", color: "#8B9097", fontSize: "13px", cursor: "pointer", textAlign: "start" }}>
<span style={{ flex: "1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{t.searchPh}
</span>
<span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "11px", border: "1px solid #D6D3CB", borderRadius: "3px", padding: "0 5px", background: "#fff" }}>
Ctrl K
</span>
</button>
</>) : null}
{mobile ? (<>
<button onClick={openSearch} style={{ height: "40px", padding: "0 12px", border: "1px solid #D6D3CB", borderRadius: "4px", background: "#fff", fontSize: "13px", cursor: "pointer" }}>
{t.search}
</button>
</>) : null}
</>) : null}
<button onClick={toggleNotif} style={{ position: "relative", height: "40px", padding: "0 12px", border: "1px solid #D6D3CB", borderRadius: "4px", background: "#fff", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
<span>
{t.notifications}
</span>
{hasUnread ? (<>
<span style={{ minWidth: "20px", height: "20px", padding: "0 6px", borderRadius: "10px", background: "#0F5C4A", color: "#fff", fontSize: "11px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
{unread}
</span>
</>) : null}
</button>
</header>
</>);
}
