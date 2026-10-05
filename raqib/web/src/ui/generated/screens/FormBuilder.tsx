/* eslint-disable */
// GENERATED from the approved Claude Design (Raqib.dc.html) by tools/transpile — do not hand-edit.
import { Fragment } from "react";
import type { VM } from "@/ui/vm";

export function FormBuilder({ vm }: { vm: VM }) {
  const { arrBack, fm, mainCols, pad, t } = vm;
  return (<>
<div style={{ padding: pad, maxWidth: "1360px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
<button onClick={fm.back} style={{ alignSelf: "flex-start", background: "none", border: "0", padding: "0", color: "#0F5C4A", fontSize: "13px", cursor: "pointer" }}>
{arrBack} {t.nav_forms_h}
</button>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "12px 20px", flexWrap: "wrap" }}>
<div style={{ minWidth: "0", flex: "1" }}>
<div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
<span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "12.5px", color: "#5C6168" }}>
{fm.code} · {fm.verLabel}
</span>
<span style={{ height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", fontWeight: "500", color: fm.verSt.fg, background: fm.verSt.bg, display: "inline-flex", alignItems: "center" }}>
{fm.verSt.label}
</span>
<span style={{ height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", color: fm.st.fg, background: fm.st.bg, display: "inline-flex", alignItems: "center" }}>
{fm.st.label}
</span>
<span style={{ fontSize: "12px", color: "#5C6168" }}>
{fm.cat}
</span>
</div>
{fm.editable ? (<>
<input value={fm.nameVal} onChange={fm.onName} style={{ marginTop: "6px", width: "100%", maxWidth: "560px", height: "42px", border: "1px solid #D6D3CB", borderRadius: "4px", padding: "0 12px", fontSize: "20px", fontWeight: "600" }} />
</>) : null}
{fm.readOnly ? (<>
<h1 style={{ margin: "4px 0 0", fontSize: "22px", fontWeight: "600" }}>
{fm.name}
</h1>
</>) : null}
<div style={{ fontSize: "13px", color: "#5C6168", marginTop: "4px" }}>
{fm.desc}
</div>
</div>
<div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
{fm.canToggle ? (<>
<button onClick={fm.toggle} style={{ height: "40px", padding: "0 14px", border: "1px solid #D6D3CB", borderRadius: "4px", background: "#fff", cursor: "pointer" }}>
{fm.toggleLabel}
</button>
</>) : null}
{fm.canDiscard ? (<>
<button onClick={fm.discard} style={{ height: "40px", padding: "0 14px", border: "1px solid #E8C4C2", borderRadius: "4px", background: "#fff", color: "#A3262A", cursor: "pointer" }}>
{t.discardDraft}
</button>
</>) : null}
{fm.canNewVersion ? (<>
<button onClick={fm.newVersion} style={{ height: "40px", padding: "0 16px", border: "1px solid #0F5C4A", borderRadius: "4px", background: "#fff", color: "#0F5C4A", fontWeight: "500", cursor: "pointer" }}>
{t.createVersion}
</button>
</>) : null}
{fm.canPublish ? (<>
<button onClick={fm.publish} style={{ height: "40px", padding: "0 18px", border: "0", borderRadius: "4px", background: "#0F5C4A", color: "#fff", fontWeight: "500", cursor: "pointer" }}>
{t.publishVersion}
</button>
</>) : null}
</div>
</div>
<div style={{ fontSize: "12.5px", color: "#191C1F", background: "#ECEAE5", borderRadius: "4px", padding: "10px 12px", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
<span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "11.5px", color: "#5C6168" }}>
{t.relationLine}
</span>
<span>
{fm.lineage}
</span>
</div>
<div style={{ display: "grid", gridTemplateColumns: mainCols, gap: "20px", alignItems: "start" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: "0" }}>
<div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "2px" }}>
{(fm.sections || []).map((x: any, __i: number) => (<Fragment key={__i}>
<button onClick={x.go} style={{ flexShrink: "0", textAlign: "start", border: "1px solid #E3E1DA", borderRadius: "4px", background: x.bg, color: x.fg, padding: "8px 12px", cursor: "pointer", lineHeight: "1.3" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "500", whiteSpace: "nowrap" }}>
{x.label}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#8B9097" }}>
{x.meta}
</span>
</button>
</Fragment>))}
{fm.editable ? (<>
<button onClick={fm.addSection} style={{ flexShrink: "0", border: "1px dashed #C9C6BE", borderRadius: "4px", background: "#fff", padding: "0 14px", cursor: "pointer", color: "#0F5C4A", fontSize: "13px" }}>
{t.addSection}
</button>
</>) : null}
</div>
{fm.readOnly ? (<>
<div style={{ fontSize: "13px", color: "#3D4247", background: "#FAF9F6", border: "1px solid #EFEDE7", borderRadius: "4px", padding: "10px 12px" }}>
{fm.roMsg}
</div>
</>) : null}
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
<div style={{ padding: "12px 16px", borderBottom: "1px solid #EFEDE7", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
{fm.editable ? (<>
<input value={fm.secTitle} onChange={fm.onSecTitle} style={{ flex: "1", minWidth: "200px", height: "38px", border: "1px solid #D6D3CB", borderRadius: "4px", padding: "0 10px", fontSize: "15px", fontWeight: "600" }} />
</>) : null}
{fm.readOnly ? (<>
<h2 style={{ margin: "0", flex: "1", fontSize: "15px", fontWeight: "600" }}>
{fm.secTitle}
</h2>
</>) : null}
<span style={{ fontSize: "12px", color: "#5C6168" }}>
{fm.wsum}
</span>
{fm.canDelSection ? (<>
<button onClick={fm.delSection} style={{ background: "none", border: "0", color: "#A3262A", fontSize: "12.5px", cursor: "pointer" }}>
{t.deleteSection}
</button>
</>) : null}
</div>
{(fm.items || []).map((it: any, __i: number) => (<Fragment key={__i}>
<div style={{ padding: "12px 16px", borderBottom: "1px solid #F3F1EC", display: "flex", flexDirection: "column", gap: "8px" }}>
<div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
<span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "12.5px", color: "#5C6168", minWidth: "30px" }}>
{it.num}
</span>
{fm.editable ? (<>
<input value={it.text} onChange={it.onText} style={{ flex: "1", minWidth: "0", height: "38px", border: "1px solid #D6D3CB", borderRadius: "4px", padding: "0 10px", fontSize: "14px" }} />
</>) : null}
{fm.readOnly ? (<>
<span style={{ flex: "1", fontSize: "14px" }}>
{it.text}
</span>
</>) : null}
<div style={{ display: "flex", alignItems: "center", border: "1px solid #D6D3CB", borderRadius: "4px", overflow: "hidden", flexShrink: "0" }}>
{fm.editable ? (<>
<button onClick={it.wDec} style={{ width: "30px", height: "34px", border: "0", background: "#FAF9F6", cursor: "pointer" }}>
−
</button>
</>) : null}
<span style={{ minWidth: "56px", textAlign: "center", fontSize: "12.5px", padding: "0 6px" }}>
{t.c_w} {it.w}
</span>
{fm.editable ? (<>
<button onClick={it.wInc} style={{ width: "30px", height: "34px", border: "0", background: "#FAF9F6", cursor: "pointer" }}>
+
</button>
</>) : null}
</div>
</div>
<div style={{ display: "flex", gap: "6px 8px", alignItems: "center", flexWrap: "wrap", paddingInlineStart: "40px" }}>
{fm.editable ? (<>
<select value={it.typeVal} onChange={it.onType} style={{ height: "32px", border: "1px solid #D6D3CB", borderRadius: "4px", padding: "0 8px", fontSize: "12.5px", background: "#fff" }}>
{(it.typeOpts || []).map((o: any, __i: number) => (<Fragment key={__i}>
<option value={o.v}>
{o.l}
</option>
</Fragment>))}
</select>
</>) : null}
{fm.readOnly ? (<>
<span style={{ fontSize: "12.5px", color: "#3D4247", background: "#ECEAE5", borderRadius: "3px", padding: "3px 8px" }}>
{it.type}
</span>
</>) : null}
<button onClick={it.tReq} disabled={fm.readOnly} style={{ height: "30px", padding: "0 10px", border: `1px solid ${it.tgC}`, color: it.tgC, background: "#fff", borderRadius: "15px", fontSize: "12px", cursor: "pointer" }}>
{t.reqLabel}: {it.reqTxt}
</button>
<button onClick={it.tNa} disabled={fm.readOnly} style={{ height: "30px", padding: "0 10px", border: `1px solid ${it.naC}`, color: it.naC, background: "#fff", borderRadius: "15px", fontSize: "12px", cursor: "pointer" }}>
{t.naLabel}: {it.naTxt}
</button>
<button onClick={it.tEv} disabled={fm.readOnly} style={{ height: "30px", padding: "0 10px", border: `1px solid ${it.evC}`, color: it.evC, background: "#fff", borderRadius: "15px", fontSize: "12px", cursor: "pointer" }}>
{t.evNcLabel}: {it.evTxt}
</button>
{fm.editable ? (<>
<span style={{ flex: "1" }}></span>
<button onClick={it.up} style={{ width: "32px", height: "30px", border: "1px solid #D6D3CB", borderRadius: "4px", background: "#fff", cursor: "pointer" }}>
↑
</button>
<button onClick={it.down} style={{ width: "32px", height: "30px", border: "1px solid #D6D3CB", borderRadius: "4px", background: "#fff", cursor: "pointer" }}>
↓
</button>
<button onClick={it.del} style={{ height: "30px", padding: "0 10px", border: "1px solid #E8C4C2", borderRadius: "4px", background: "#fff", color: "#A3262A", fontSize: "12px", cursor: "pointer" }}>
{t.remove}
</button>
</>) : null}
</div>
</div>
</Fragment>))}
{fm.noItems ? (<>
<div style={{ padding: "24px", textAlign: "center", color: "#5C6168", fontSize: "13px" }}>
{t.noItems}
</div>
</>) : null}
{fm.editable ? (<>
<div style={{ padding: "12px 16px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
<button onClick={fm.addItem} style={{ height: "38px", padding: "0 14px", border: "1px dashed #0F5C4A", borderRadius: "4px", background: "#fff", color: "#0F5C4A", cursor: "pointer" }}>
{t.addItem}
</button>
<span style={{ fontSize: "12px", color: "#8B9097" }}>
{fm.langNote} {fm.savedTxt}
</span>
</div>
</>) : null}
</section>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: "0" }}>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 16px", borderBottom: "1px solid #EFEDE7" }}>
{t.versionHistory}
</h2>
<div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
{(fm.versions || []).map((v: any, __i: number) => (<Fragment key={__i}>
<button onClick={v.go} style={{ textAlign: "start", border: `1px solid ${v.bd}`, background: v.bg, borderRadius: "4px", padding: "10px 12px", cursor: "pointer", display: "flex", flexDirection: "column", gap: "3px" }}>
<span style={{ display: "flex", gap: "8px", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
<span style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: "600" }}>
{v.v}
</span>
<span style={{ height: "20px", padding: "0 7px", borderRadius: "3px", fontSize: "11.5px", color: v.st.fg, background: v.st.bg }}>
{v.st.label}
</span>
</span>
<span style={{ fontSize: "12.5px", color: "#3D4247" }}>
{v.note}
</span>
<span style={{ fontSize: "11.5px", color: "#8B9097" }}>
{v.by} · {v.at} · {v.uses}
</span>
</button>
</Fragment>))}
</div>
</section>
{fm.hasDiff ? (<>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 16px", borderBottom: "1px solid #EFEDE7" }}>
{t.changesVs} {fm.pubV}
</h2>
{(fm.diff || []).map((d: any, __i: number) => (<Fragment key={__i}>
<div style={{ padding: "8px 16px", borderBottom: "1px solid #F3F1EC", fontSize: "13px", color: d.c }}>
{d.t}
</div>
</Fragment>))}
</section>
</>) : null}
{fm.hasUsedBy ? (<>
<section style={{ background: "#fff", border: "1px solid #E3E1DA", borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 16px", borderBottom: "1px solid #EFEDE7" }}>
{t.boundInspections}
</h2>
{(fm.usedBy || []).map((u: any, __i: number) => (<Fragment key={__i}>
<button onClick={u.go} style={{ width: "100%", display: "flex", justifyContent: "space-between", gap: "8px", padding: "9px 16px", border: "0", borderBottom: "1px solid #F3F1EC", background: "#fff", cursor: "pointer" }}>
<span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "12.5px" }}>
{u.ref}
</span>
<span style={{ fontSize: "12px", color: u.st.fg }}>
{u.st.label}
</span>
</button>
</Fragment>))}
</section>
</>) : null}
</div>
</div>
</div>
</>);
}
