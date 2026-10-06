import type { Form, FormChange, FormSection, FormVersion, ItemType } from "@/api/types";
import { badge } from "../common";
import type { Ctx } from "../context";
import { C } from "@/styles/colors";

const TYPES: ItemType[] = ["cnx", "yesno", "number", "text", "select", "date", "scale5"];
const catKey = (f: Form) => `fc_${f.category}`;

const verTone = (st: FormVersion["status"]) => (st === "published" ? "ok" : st === "draft" ? "warn" : "neu");

/** Forms list (design: vmForms). */
export function formsList(c: Ctx) {
  const { i, data } = c;
  const caps = data.forms?.capabilities;
  const rows = (data.forms?.items ?? []).map((f) => {
    const pub = f.versions.find((v) => v.status === "published");
    const draft = f.versions.find((v) => v.status === "draft");
    return {
      name: i.L(f.name), code: f.code, cat: i.S(catKey(f)), st: badge(f.active ? i.S("active") : i.S("inactive"), f.active ? "ok" : "neu"),
      cur: pub ? `v${pub.version}` : "—", draft: draft ? i.S("draftV", { v: draft.version }) : "", hasDraft: !!draft,
      by: pub?.by ? i.L(pub.by.name) : "—", updated: i.fd(f.updatedAt, "d"), uses: String(f.versions.reduce((a, v) => a + v.uses, 0)), nver: String(f.versions.length),
      go: () => c.go("form", f.id, { fb: {} }),
    };
  });
  return {
    fl: {
      rows, canAdd: !!caps?.add,
      add: () => c.openModal("formNew", undefined, { fcat: "site" }),
    },
  };
}

function changeText(c: Ctx, ch: FormChange): { t: string; c: string } {
  const { i } = c;
  switch (ch.kind) {
    case "added": return { t: i.S("df_added", { n: ch.num, x: i.L(ch.text) }), c: C.status.success.fg };
    case "removed": return { t: i.S("df_removed", { n: ch.num, x: i.L(ch.text) }), c: C.status.danger.fg };
    case "weight": return { t: i.S("df_weight", { n: ch.num, a: ch.from, b: ch.to }), c: C.status.warning.fg };
    case "text": return { t: i.S("df_text", { n: ch.num }), c: C.status.warning.fg };
    case "rules": return { t: i.S("df_rules", { n: ch.num }), c: C.status.warning.fg };
    case "sections": return { t: i.S("df_sections", { a: ch.from, b: ch.to }), c: C.status.warning.fg };
  }
}
export const diffLines = changeText;

let saveTimer: ReturnType<typeof setTimeout> | undefined;

/** Form builder (design: vmForm). Only a draft is editable; edits show at once and are saved after a short pause. */
export function formBuilder(c: Ctx, f: Form) {
  const { i, ui, set } = c;
  const caps = c.data.forms?.capabilities;
  const pub = f.versions.find((v) => v.status === "published");
  const draft = f.versions.find((v) => v.status === "draft");
  const ver = f.versions.find((v) => v.id === ui.fb.ver) ?? draft ?? pub ?? f.versions[0]!;
  const editable = ver.status === "draft" && !!caps?.edit;
  const sections: FormSection[] = ui.fbDraft && ui.fbDraft.versionId === ver.id ? ui.fbDraft.sections : ver.sections;
  const si = Math.min(ui.fb.sec ?? 0, Math.max(0, sections.length - 1));
  const sec = sections[si];
  const lang = i.lang;

  const ed = (fn: (s: FormSection[]) => void) => {
    if (!editable) return;
    const next: FormSection[] = JSON.parse(JSON.stringify(sections));
    fn(next);
    set({ fbDraft: { versionId: ver.id, sections: next } });
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void c.actions.saveDraft(f.id, next).then(() => set({ savedAt: new Date().toTimeString().slice(0, 5) })).catch(() => c.toast(i.S("actionFailed"))), 700);
  };

  const items = sec
    ? sec.items.map((q, qi) => ({
        num: `${si + 1}.${qi + 1}`, text: i.L(q.text), w: String(q.weight), type: i.S(`rt_${q.type}`), req: q.required, na: q.na, evNC: q.evidenceOnNc,
        reqTxt: q.required ? i.S("yes") : i.S("no"), naTxt: q.na ? i.S("allowed") : i.S("notAllowed"), evTxt: q.evidenceOnNc ? i.S("required") : i.S("optional"),
        onText: (e: { target: { value: string } }) => ed((s) => { s[si]!.items[qi]!.text[lang] = e.target.value; }),
        wDec: () => ed((s) => { const x = s[si]!.items[qi]!; x.weight = Math.max(0, x.weight - 1); }),
        wInc: () => ed((s) => { const x = s[si]!.items[qi]!; x.weight = Math.min(10, x.weight + 1); }),
        tReq: () => ed((s) => { const x = s[si]!.items[qi]!; x.required = !x.required; }),
        tNa: () => ed((s) => { const x = s[si]!.items[qi]!; x.na = !x.na; }),
        tEv: () => ed((s) => { const x = s[si]!.items[qi]!; x.evidenceOnNc = !x.evidenceOnNc; }),
        typeVal: q.type, typeOpts: TYPES.map((k) => ({ v: k, l: i.S(`rt_${k}`) })),
        onType: (e: { target: { value: string } }) => ed((s) => { s[si]!.items[qi]!.type = e.target.value as ItemType; }),
        up: () => ed((s) => { const a = s[si]!.items; if (qi > 0) [a[qi - 1], a[qi]] = [a[qi]!, a[qi - 1]!]; }),
        down: () => ed((s) => { const a = s[si]!.items; if (qi < a.length - 1) [a[qi + 1], a[qi]] = [a[qi]!, a[qi + 1]!]; }),
        canUp: qi > 0, canDown: qi < sec.items.length - 1,
        del: () => ed((s) => { s[si]!.items.splice(qi, 1); }),
        tgC: q.required ? C.brand.primary : C.border.stronger, naC: q.na ? C.brand.primary : C.border.stronger, evC: q.evidenceOnNc ? C.brand.primary : C.border.stronger,
      }))
    : [];
  const wsum = sec ? sec.items.reduce((a, q) => a + q.weight, 0) : 0;
  const total = sections.reduce((a, x) => a + x.items.reduce((b, q) => b + q.weight, 0), 0);
  const diff = ver.status === "draft" ? f.diff.map((d) => changeText(c, d)) : [];
  const pubUses = pub?.uses ?? 0;

  return {
    fm: {
      name: i.L(f.name), code: f.code, cat: i.S(catKey(f)), desc: i.L(f.description), st: badge(f.active ? i.S("active") : i.S("inactive"), f.active ? "ok" : "neu"),
      verLabel: `v${ver.version}`, verSt: badge(i.S(`fvs_${ver.status}`), verTone(ver.status)),
      editable, readOnly: !editable, roMsg: ver.status === "draft" ? i.S("fb_noEdit") : i.S("fb_locked", { v: ver.version }),
      nameVal: i.L(f.name), canRename: !!c.me.permissions.forms.includes("E"),
      rename: () => c.openModal("formRename", { id: f.id }, { nameAr: f.name.ar, nameEn: f.name.en }),
      versions: f.versions.map((v) => ({
        v: `v${v.version}`, st: badge(i.S(`fvs_${v.status}`), verTone(v.status)), by: v.by ? i.L(v.by.name) : "—", at: i.fd(v.at, "d"), note: i.L(v.note),
        uses: i.S("nInsp", { n: v.uses }), bg: v.id === ver.id ? C.brand.wash : C.surface.white, bd: v.id === ver.id ? C.brand.primary : C.border.hairline,
        go: () => set({ fb: { ver: v.id, sec: 0 }, fbDraft: null }),
      })),
      sections: sections.map((x, idx) => ({
        label: `${idx + 1}. ${i.L(x.title)}`, meta: i.S("secMeta", { n: x.items.length, w: x.items.reduce((a, q) => a + q.weight, 0) }),
        bg: idx === si ? C.brand.wash : C.surface.white, fg: idx === si ? C.brand.primaryDark : C.text.ink, go: () => set({ fb: { ver: ver.id, sec: idx } }),
      })),
      secTitle: sec ? i.L(sec.title) : "", onSecTitle: (e: { target: { value: string } }) => ed((s) => { s[si]!.title[lang] = e.target.value; }), hasSec: !!sec,
      items, hasItems: items.length > 0, noItems: items.length === 0, wsum: i.S("secWeight", { w: wsum, t: total }),
      addItem: () => ed((s) => { s[si]!.items.push({ key: `q${Date.now().toString(36)}`, text: { ar: "بند جديد", en: "New item" }, weight: 1, type: "cnx", required: true, na: true, evidenceOnNc: true }); }),
      addSection: () => c.openModal("newSection", { fid: f.id, vid: ver.id }),
      delSection: () => { if (sections.length > 1) { ed((s) => { s.splice(si, 1); }); set({ fb: { ver: ver.id, sec: 0 } }); } },
      canDelSection: editable && sections.length > 1,
      canNewVersion: !!caps?.edit && !draft && f.active,
      newVersion: () => void c.actions.createDraft(f.id).then(() => { set({ fb: {}, fbDraft: null }); c.toast(i.S("toastNewVer", { v: "" }).replace(/\s*v?\s*$/, "")); }).catch(() => c.toast(i.S("actionFailed"))),
      canPublish: !!caps?.publish && ver.status === "draft" && f.active || (!!caps?.publish && ver.status === "draft" && !pub),
      publish: () => c.openModal("publish", { fid: f.id, ref: `${f.code} v${ver.version}`, diff: diff, uses: pubUses, oldV: pub?.version ?? "" }),
      canDiscard: editable, discard: () => c.openModal("discardDraft", { fid: f.id, ref: `${f.code} v${ver.version}` }),
      canToggle: !!caps?.edit,
      toggleLabel: f.active ? i.S("deactivate") : i.S("activate"),
      toggle: () => (f.active ? c.openModal("deactivateForm", { fid: f.id, ref: f.code }) : void c.actions.setFormActive(f.id, true, "Activated").catch((e: unknown) => c.toast(e instanceof Error ? e.message : i.S("actionFailed")))),
      isDraftSel: ver.status === "draft", diff, hasDiff: ver.status === "draft" && diff.length > 0, pubV: pub ? `v${pub.version}` : "—",
      lineage: i.S("lineage", { f: f.code, v: ver.version, n: ver.uses }), usedBy: [], hasUsedBy: false,
      savedTxt: ui.savedAt ? i.S("autosaved", { t: ui.savedAt }) : "", back: () => c.go("forms"), langNote: i.S("fb_langNote"),
    },
  };
}
