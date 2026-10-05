/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import { Fragment } from "react";
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";
import { FONT } from "@/styles/typography";

export function ConfidentialArea({ vm }: { vm: VM }) {
  const { cfx, hpad, pad, t } = vm;
  return (<>
<div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
<div style={{ background: C.status.danger.deepest, color: C.status.danger.bgSoft, padding: `10px ${hpad}`, display: "flex", gap: "10px", alignItems: "center", fontSize: "13px", flexWrap: "wrap" }}>
<span style={{ width: "8px", height: "8px", borderRadius: "50%", background: C.status.danger.bright, flexShrink: "0" }}></span>
<span style={{ fontWeight: "600" }}>
{t.restrictedArea}
</span>
<span style={{ color: C.status.danger.borderMuted }}>
{t.restrictedLine}
</span>
</div>
{cfx.isGuard ? (<>
<div style={{ padding: pad, maxWidth: "720px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "18px" }}>
{cfx.done ? (<>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px", padding: "22px", display: "flex", flexDirection: "column", gap: "10px" }}>
<div style={{ fontSize: "13px", color: C.status.success.fg, fontWeight: "600" }}>
{t.cfSent}
</div>
<div style={{ fontFamily: FONT.mono, fontSize: "22px", fontWeight: "500" }}>
{cfx.doneRef}
</div>
<div style={{ fontSize: "13.5px", color: C.text.body }}>
{cfx.doneMsg}
</div>
<button onClick={cfx.again} style={{ alignSelf: "flex-start", height: "44px", padding: "0 16px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, cursor: "pointer" }}>
{t.cfAnother}
</button>
</section>
</>) : null}
{cfx.notDone ? (<>
<div>
<h1 style={{ margin: "0", fontSize: "22px", fontWeight: "600" }}>
{t.cfNewTitle}
</h1>
<div style={{ fontSize: "13px", color: C.text.secondary }}>
{t.cfNewSub}
</div>
</div>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px", padding: "18px", display: "flex", flexDirection: "column", gap: "14px" }}>
<div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", border: `1px solid ${C.border.input}`, borderRadius: "4px", overflow: "hidden" }}>
{(cfx.kinds || []).map((o: any, __i: number) => (<Fragment key={__i}>
<button onClick={o.set} style={{ border: "0", height: "46px", fontSize: "14px", cursor: "pointer", background: o.bg, color: o.fg }}>
{o.label}
</button>
</Fragment>))}
</div>
<label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: "500" }}>
{t.cfSubject}
<input value={cfx.subject} onChange={cfx.onSubject} style={{ height: "46px", border: `1px solid ${cfx.subjBd}`, borderRadius: "4px", padding: "0 12px", fontSize: "15px", fontWeight: "400" }} />
</label>
<label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: "500" }}>
{t.cfBody}
<textarea value={cfx.body} onChange={cfx.onBody} rows={5} style={{ border: `1px solid ${cfx.bodyBd}`, borderRadius: "4px", padding: "10px 12px", fontSize: "15px", fontWeight: "400", resize: "vertical", lineHeight: "1.5" }}></textarea>
</label>
{cfx.err ? (<>
<div style={{ fontSize: "12.5px", color: C.status.danger.fg }}>
{t.cfErr}
</div>
</>) : null}
<label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: "500" }}>
{t.cfPlace}
<input value={cfx.place} onChange={cfx.onPlace} style={{ height: "46px", border: `1px solid ${C.border.input}`, borderRadius: "4px", padding: "0 12px", fontSize: "15px", fontWeight: "400" }} />
</label>
<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
<span style={{ fontSize: "13px", fontWeight: "500" }}>
{t.cfIdentity}
</span>
{(cfx.idOpts || []).map((o: any, __i: number) => (<Fragment key={__i}>
<button onClick={o.set} style={{ display: "flex", gap: "12px", alignItems: "flex-start", padding: "12px 14px", border: `1.5px solid ${o.bd}`, background: o.bg, borderRadius: "4px", cursor: "pointer", textAlign: "start", minHeight: "56px" }}>
<span style={{ width: "18px", height: "18px", borderRadius: "50%", border: `2px solid ${o.bd}`, background: C.surface.white, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0", marginTop: "2px" }}>
<span style={{ width: "8px", height: "8px", borderRadius: "50%", background: o.dot }}></span>
</span>
<span>
<span style={{ display: "block", fontWeight: "500" }}>
{o.label}
</span>
<span style={{ display: "block", fontSize: "12.5px", color: C.text.secondary }}>
{o.sub}
</span>
</span>
</button>
</Fragment>))}
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
{cfx.hasFiles ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
{(cfx.files || []).map((e: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "flex", gap: "10px", alignItems: "center", border: `1px solid ${C.border.hairline}`, borderRadius: "4px", padding: "8px 10px" }}>
<span style={{ fontFamily: FONT.mono, fontSize: "10.5px", background: C.surface.sunken, padding: "2px 6px", borderRadius: "2px" }}>
{e.kindLabel}
</span>
<span dir="ltr" style={{ flex: "1", fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "start" }}>
{e.name}
</span>
<span style={{ fontSize: "11.5px", color: e.stC }}>
{e.meta}
</span>
{e.canRemove ? (<>
<button onClick={e.remove} style={{ background: "none", border: "0", color: C.status.danger.fg, fontSize: "12px", cursor: "pointer" }}>
{t.remove}
</button>
</>) : null}
</div>
</Fragment>))}
</div>
</>) : null}
<button onClick={cfx.attach} style={{ alignSelf: "flex-start", height: "44px", padding: "0 16px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, cursor: "pointer" }}>
{t.cfAttach}
</button>
</div>
<button onClick={cfx.submit} style={{ height: "52px", border: "0", borderRadius: "4px", background: C.brand.primary, color: C.surface.white, fontSize: "15.5px", fontWeight: "500", cursor: "pointer" }}>
{t.cfSubmit}
</button>
<div style={{ fontSize: "12.5px", color: C.text.secondary }}>
{t.cfVisibility}
</div>
</section>
</>) : null}
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px" }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600", padding: "14px 16px", borderBottom: `1px solid ${C.surface.track}` }}>
{t.cfMine}
</h2>
{(cfx.mine || []).map((c: any, __i: number) => (<Fragment key={__i}>
<div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.surface.subtle}`, display: "flex", flexDirection: "column", gap: "6px" }}>
<div style={{ display: "flex", gap: "8px", alignItems: "center", justifyContent: "space-between" }}>
<span style={{ fontFamily: FONT.mono, fontSize: "12px", color: C.text.secondary }}>
{c.ref} · {c.kind} · {c.at}
</span>
<span style={{ height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", fontWeight: "500", color: c.st.fg, background: c.st.bg, display: "inline-flex", alignItems: "center", whiteSpace: "nowrap" }}>
{c.st.label}
</span>
</div>
<div style={{ fontWeight: "500" }}>
{c.subject}
</div>
{c.hasResp ? (<>
<div style={{ fontSize: "13.5px", background: C.brand.wash, borderRadius: "4px", padding: "10px 12px" }}>
<div style={{ fontSize: "12px", color: C.brand.primary, fontWeight: "600" }}>
{t.qmResponse}
</div>
{c.resp}
</div>
</>) : null}
</div>
</Fragment>))}
</section>
</div>
</>) : null}
{cfx.gate ? (<>
<div style={{ padding: pad, maxWidth: "560px", width: "100%", margin: "24px auto" }}>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px", padding: "24px", display: "flex", flexDirection: "column", gap: "14px" }}>
<h1 style={{ margin: "0", fontSize: "20px", fontWeight: "600" }}>
{t.gateTitle}
</h1>
<div style={{ fontSize: "13.5px", color: C.text.body }}>
{t.gateBody}
</div>
<div style={{ fontSize: "12.5px", background: C.surface.sunken, borderRadius: "4px", padding: "10px 12px" }}>
{cfx.grant}
</div>
<label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: "500" }}>
{t.gateReason} 
<select value={cfx.why} onChange={cfx.onWhy} style={{ height: "42px", border: `1px solid ${C.border.input}`, borderRadius: "4px", padding: "0 10px", fontSize: "14px", background: C.surface.white }}>
<option value="">
{t.choose}
</option>
{(cfx.reasons || []).map((o: any, __i: number) => (<Fragment key={__i}>
<option value={o.v}>
{o.l}
</option>
</Fragment>))}
</select>
</label>
<label style={{ display: "flex", gap: "10px", alignItems: "flex-start", fontSize: "13px", cursor: "pointer" }}>
<input type="checkbox" checked={cfx.ack} onChange={cfx.onAck} style={{ width: "18px", height: "18px", accentColor: C.brand.primary, marginTop: "2px", flexShrink: "0" }} />
{t.gateAck}
</label>
{cfx.gateErr ? (<>
<div style={{ fontSize: "12.5px", color: C.status.danger.fg }}>
{t.gateErr}
</div>
</>) : null}
<div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
<button onClick={cfx.leave} style={{ height: "42px", padding: "0 16px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, cursor: "pointer" }}>
{t.cancel}
</button>
<button onClick={cfx.enter} style={{ height: "42px", padding: "0 18px", border: "0", borderRadius: "4px", background: C.status.danger.deepest, color: C.surface.white, fontWeight: "500", cursor: "pointer" }}>
{t.gateEnter}
</button>
</div>
</section>
</div>
</>) : null}
{cfx.isGM ? (<>
<div style={{ padding: pad, maxWidth: "1240px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
<div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
<div>
<h1 style={{ margin: "0", fontSize: "20px", fontWeight: "600" }}>
{t.grantMgmt}
</h1>
<div style={{ fontSize: "13px", color: C.text.secondary }}>
{cfx.sessionTxt}
</div>
</div>
<div style={{ display: "flex", gap: "8px" }}>
<button onClick={cfx.exit} style={{ height: "40px", padding: "0 14px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, cursor: "pointer" }}>
{t.exitArea}
</button>
<button onClick={cfx.addGrant} style={{ height: "40px", padding: "0 16px", border: "0", borderRadius: "4px", background: C.status.danger.deepest, color: C.surface.white, cursor: "pointer" }}>
{t.issueGrant}
</button>
</div>
</div>
<div style={{ fontSize: "13px", color: C.status.danger.bgSoft, background: C.status.danger.deepest, borderRadius: "4px", padding: "12px 14px" }}>
{cfx.gmNote} {cfx.grant}
</div>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px" }}>
{(cfx.grants || []).map((g: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "flex", gap: "10px 16px", alignItems: "center", padding: "12px 18px", borderBottom: `1px solid ${C.surface.subtle}`, flexWrap: "wrap" }}>
<span style={{ flex: "1", minWidth: "220px" }}>
<span style={{ display: "block", fontWeight: "500" }}>
{g.who}
</span>
<span style={{ display: "block", fontSize: "12px", color: C.text.muted }}>
{g.lv} · {g.scope} · {g.by} · {g.at} · {g.exp}
</span>
<span style={{ display: "block", fontSize: "12.5px", color: C.text.body }}>
{g.why}
</span>
{g.revoked ? (<>
<span style={{ display: "block", fontSize: "12px", color: C.text.secondary }}>
{g.revTxt}
</span>
</>) : null}
</span>
<span style={{ height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", color: g.st.fg, background: g.st.bg, display: "inline-flex", alignItems: "center" }}>
{g.st.label}
</span>
{g.active ? (<>
<button onClick={g.revoke} style={{ height: "34px", padding: "0 12px", border: `1px solid ${C.status.danger.border}`, borderRadius: "4px", background: C.surface.white, color: C.status.danger.fg, cursor: "pointer", fontSize: "13px" }}>
{t.revoke}
</button>
</>) : null}
</div>
</Fragment>))}
</section>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px" }}>
<div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.surface.track}` }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600" }}>
{t.protectedAudit}
</h2>
<div style={{ fontSize: "12px", color: C.text.muted }}>
{t.protectedAuditSub}
</div>
</div>
{(cfx.fullLog || []).map((a: any, __i: number) => (<Fragment key={__i}>
<div style={{ display: "flex", gap: "6px 14px", padding: "9px 18px", borderBottom: `1px solid ${C.surface.subtle}`, fontSize: "12.5px", flexWrap: "wrap" }}>
<span style={{ minWidth: "110px", color: C.text.secondary }}>
{a.at}
</span>
<span style={{ fontWeight: "600" }}>
{a.act}
</span>
<span>
{a.who}
</span>
<span style={{ fontFamily: FONT.mono, fontSize: "12px" }}>
{a.ref}
</span>
<span style={{ color: C.text.body }}>
{a.why}
</span>
<span dir="ltr" style={{ fontFamily: FONT.mono, fontSize: "11.5px", color: C.text.muted }}>
{a.dev}
</span>
</div>
</Fragment>))}
</section>
</div>
</>) : null}
{cfx.insideOfficer ? (<>
<div style={{ padding: pad, maxWidth: "1360px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
<div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
<div style={{ fontSize: "13px", color: C.text.secondary }}>
{cfx.sessionTxt} · {cfx.myGrant}
</div>
<button onClick={cfx.exit} style={{ height: "36px", padding: "0 14px", border: `1px solid ${C.border.input}`, borderRadius: "4px", background: C.surface.white, cursor: "pointer", fontSize: "13px" }}>
{t.exitArea}
</button>
</div>
<div style={{ display: "grid", gridTemplateColumns: cfx.listCols, gap: "16px", alignItems: "start" }}>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px" }}>
{(cfx.list || []).map((c: any, __i: number) => (<Fragment key={__i}>
<button onClick={c.go} style={{ width: "100%", display: "flex", flexDirection: "column", gap: "3px", padding: "12px 16px", border: "0", borderBottom: `1px solid ${C.surface.track}`, background: c.bg, cursor: "pointer", textAlign: "start" }}>
<span style={{ display: "flex", justifyContent: "space-between", gap: "8px", width: "100%" }}>
<span style={{ fontFamily: FONT.mono, fontSize: "12px", color: C.text.secondary }}>
{c.ref} · {c.kind}
</span>
<span style={{ height: "20px", padding: "0 7px", borderRadius: "3px", fontSize: "11.5px", color: c.st.fg, background: c.st.bg, whiteSpace: "nowrap" }}>
{c.st.label}
</span>
</span>
<span style={{ fontWeight: "500" }}>
{c.subject}
</span>
<span style={{ fontSize: "12px", color: C.text.muted }}>
{c.at} 
{c.hasSens ? (<>
<span style={{ color: C.status.danger.fg, fontWeight: "600" }}>
· {c.sens}
</span>
</>) : null}
</span>
</button>
</Fragment>))}
</section>
<div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: "0" }}>
{cfx.noSel ? (<>
<div style={{ background: C.surface.white, border: `1px dashed ${C.border.input}`, borderRadius: "6px", padding: "32px", textAlign: "center", color: C.text.secondary }}>
{t.selectReport}
</div>
</>) : null}
{cfx.hasSel ? (<>
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px", padding: "18px", display: "flex", flexDirection: "column", gap: "14px" }}>
<div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
<span style={{ fontFamily: FONT.mono, fontSize: "12.5px", color: C.text.secondary }}>
{cfx.sel.ref}
</span>
<span style={{ height: "22px", padding: "0 8px", borderRadius: "3px", fontSize: "12px", fontWeight: "500", color: cfx.sel.st.fg, background: cfx.sel.st.bg, display: "inline-flex", alignItems: "center" }}>
{cfx.sel.st.label}
</span>
<span style={{ fontSize: "12px", color: C.text.secondary }}>
{cfx.sel.kind} · {cfx.sel.sens} · {cfx.sel.at}
</span>
</div>
<h2 style={{ margin: "0", fontSize: "18px", fontWeight: "600" }}>
{cfx.sel.subject}
</h2>
<div style={{ border: `1px solid ${C.surface.track}`, borderRadius: "4px", padding: "12px 14px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", background: C.surface.paper }}>
<div style={{ flex: "1", minWidth: "200px" }}>
<div style={{ fontSize: "12px", color: C.text.muted }}>
{t.reporterIdentity}
</div>
{cfx.sel.isAnon ? (<>
<div style={{ fontWeight: "500" }}>
{t.anonymous}
</div>
</>) : null}
{cfx.sel.masked ? (<>
<div style={{ fontWeight: "500", letterSpacing: ".1em" }}>
•••••• ••••••
</div>
<div style={{ fontSize: "12px", color: C.text.secondary }}>
{t.identityProtected}
</div>
</>) : null}
{cfx.sel.revealedId ? (<>
<div style={{ fontWeight: "600" }}>
{cfx.sel.idName}
</div>
<div style={{ fontSize: "12px", color: C.text.secondary, fontFamily: FONT.mono }}>
{cfx.sel.idEmp}
</div>
</>) : null}
</div>
{cfx.sel.masked ? (<>
<button onClick={cfx.sel.reveal} style={{ height: "38px", padding: "0 14px", border: `1px solid ${C.status.danger.deepest}`, borderRadius: "4px", background: C.surface.white, cursor: "pointer", fontSize: "13px" }}>
{t.revealIdentity}
</button>
</>) : null}
</div>
<div style={{ fontSize: "14px", lineHeight: "1.65" }}>
{cfx.sel.body}
</div>
<div style={{ fontSize: "12.5px", color: C.text.secondary }}>
{t.attachments}: {cfx.sel.files}
</div>
{cfx.sel.hasResp ? (<>
<div style={{ background: C.brand.wash, borderRadius: "4px", padding: "12px 14px", fontSize: "13.5px" }}>
<div style={{ fontSize: "12px", color: C.brand.primary, fontWeight: "600" }}>
{t.responseSent}
</div>
{cfx.sel.response}
</div>
</>) : null}
{cfx.sel.canRespond ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
<textarea value={cfx.sel.comment} onChange={cfx.sel.onComment} rows={3} placeholder={t.responsePh} style={{ border: `1px solid ${C.border.input}`, borderRadius: "4px", padding: "10px 12px", fontSize: "14px", resize: "vertical" }}></textarea>
<button onClick={cfx.sel.respond} style={{ alignSelf: "flex-start", height: "40px", padding: "0 16px", border: "0", borderRadius: "4px", background: C.brand.primary, color: C.surface.white, cursor: "pointer" }}>
{t.sendResponse}
</button>
</div>
</>) : null}
{cfx.sel.anonNoReply ? (<>
<div style={{ fontSize: "12.5px", color: C.text.secondary }}>
{t.anonNoReply}
</div>
</>) : null}
</section>
</>) : null}
<section style={{ background: C.surface.white, border: `1px solid ${C.border.hairline}`, borderRadius: "6px" }}>
<div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.surface.track}` }}>
<h2 style={{ margin: "0", fontSize: "15px", fontWeight: "600" }}>
{t.protectedAudit}
</h2>
<div style={{ fontSize: "12px", color: C.text.muted }}>
{t.protectedAuditSub}
</div>
</div>
<div style={{ overflowX: "auto" }}>
<table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px", minWidth: "620px" }}>
<thead>
<tr style={{ background: C.surface.paper }}>
<th style={{ textAlign: "start", padding: "8px 12px", fontWeight: "500", color: C.text.secondary, borderBottom: `1px solid ${C.border.hairline}` }}>
{t.c_time}
</th>
<th style={{ textAlign: "start", padding: "8px 12px", fontWeight: "500", color: C.text.secondary, borderBottom: `1px solid ${C.border.hairline}` }}>
{t.c_user}
</th>
<th style={{ textAlign: "start", padding: "8px 12px", fontWeight: "500", color: C.text.secondary, borderBottom: `1px solid ${C.border.hairline}` }}>
{t.c_action}
</th>
<th style={{ textAlign: "start", padding: "8px 12px", fontWeight: "500", color: C.text.secondary, borderBottom: `1px solid ${C.border.hairline}` }}>
{t.c_entity}
</th>
<th style={{ textAlign: "start", padding: "8px 12px", fontWeight: "500", color: C.text.secondary, borderBottom: `1px solid ${C.border.hairline}` }}>
{t.c_reason}
</th>
<th style={{ textAlign: "start", padding: "8px 12px", fontWeight: "500", color: C.text.secondary, borderBottom: `1px solid ${C.border.hairline}` }}>
{t.c_device}
</th>
</tr>
</thead>
<tbody>
{(cfx.access || []).map((a: any, __i: number) => (<Fragment key={__i}>
<tr>
<td style={{ padding: "8px 12px", borderBottom: `1px solid ${C.surface.track}`, whiteSpace: "nowrap" }}>
{a.at}
</td>
<td style={{ padding: "8px 12px", borderBottom: `1px solid ${C.surface.track}` }}>
{a.who}
</td>
<td style={{ padding: "8px 12px", borderBottom: `1px solid ${C.surface.track}`, fontWeight: "500" }}>
{a.act}
</td>
<td style={{ padding: "8px 12px", borderBottom: `1px solid ${C.surface.track}`, fontFamily: FONT.mono, fontSize: "12px" }}>
{a.ref}
</td>
<td style={{ padding: "8px 12px", borderBottom: `1px solid ${C.surface.track}` }}>
{a.why}
</td>
<td dir="ltr" style={{ padding: "8px 12px", borderBottom: `1px solid ${C.surface.track}`, fontFamily: FONT.mono, fontSize: "11.5px", color: C.text.secondary, textAlign: "start" }}>
{a.dev}
</td>
</tr>
</Fragment>))}
</tbody>
</table>
</div>
</section>
</div>
</div>
</div>
</>) : null}
</div>
</>);
}
