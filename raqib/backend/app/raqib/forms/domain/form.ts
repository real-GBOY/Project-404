import type { L10n } from "@raqib/raqib/shared/l10n.js";

/**
 * Form structure (pure). A form VERSION is a list of sections of items; items keep a stable `key` across
 * versions so a diff can tell "weight changed" from "item replaced". Published versions are frozen in the database.
 */
export const ITEM_TYPES = ["cnx", "yesno", "number", "text", "select", "date", "scale5"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export interface FormItem {
  key: string;
  text: L10n;
  weight: number;
  type: ItemType;
  required: boolean;
  /** "Not applicable" is a permitted answer. */
  na: boolean;
  /** Evidence is mandatory when the item is answered non-compliant. */
  evidenceOnNc: boolean;
}
export interface FormSection {
  key: string;
  title: L10n;
  items: FormItem[];
}

export interface StructureIssue {
  code: "no_sections" | "empty_section" | "duplicate_key" | "no_weight" | "blank_text";
  at: string;
}

/** Problems that make a structure unfit to PUBLISH (a draft may be incomplete while it is being built). */
export function publishIssues(sections: FormSection[]): StructureIssue[] {
  const out: StructureIssue[] = [];
  if (!sections.length) return [{ code: "no_sections", at: "" }];
  const seen = new Set<string>();
  let anyWeight = false;
  sections.forEach((s, si) => {
    if (!s.items.length) out.push({ code: "empty_section", at: String(si + 1) });
    s.items.forEach((it, ii) => {
      const at = `${si + 1}.${ii + 1}`;
      if (seen.has(it.key)) out.push({ code: "duplicate_key", at });
      seen.add(it.key);
      if (!it.text.ar.trim() || !it.text.en.trim()) out.push({ code: "blank_text", at });
      if (it.weight > 0) anyWeight = true;
    });
  });
  if (!anyWeight) out.push({ code: "no_weight", at: "" });
  return out;
}

export type FormChange =
  | { kind: "added"; num: string; text: L10n }
  | { kind: "removed"; num: string; text: L10n }
  | { kind: "weight"; num: string; from: number; to: number }
  | { kind: "text"; num: string }
  | { kind: "rules"; num: string }
  | { kind: "sections"; from: number; to: number };

const flat = (sections: FormSection[]) => {
  const m = new Map<string, { num: string; item: FormItem }>();
  sections.forEach((s, si) => s.items.forEach((item, ii) => m.set(item.key, { num: `${si + 1}.${ii + 1}`, item })));
  return m;
};

/** What changed from `prev` to `next` (the structured list the dialog and release notes render). */
export function diffVersions(prev: FormSection[] | null, next: FormSection[]): FormChange[] {
  const a = flat(prev ?? []);
  const b = flat(next);
  const out: FormChange[] = [];
  for (const [key, n] of b) {
    const p = a.get(key);
    if (!p) {
      out.push({ kind: "added", num: n.num, text: n.item.text });
      continue;
    }
    if (p.item.weight !== n.item.weight) out.push({ kind: "weight", num: n.num, from: p.item.weight, to: n.item.weight });
    if (p.item.text.ar !== n.item.text.ar || p.item.text.en !== n.item.text.en) out.push({ kind: "text", num: n.num });
    if (p.item.required !== n.item.required || p.item.na !== n.item.na || p.item.type !== n.item.type || p.item.evidenceOnNc !== n.item.evidenceOnNc) {
      out.push({ kind: "rules", num: n.num });
    }
  }
  for (const [key, p] of a) if (!b.has(key)) out.push({ kind: "removed", num: p.num, text: p.item.text });
  if (prev && prev.length !== next.length) out.push({ kind: "sections", from: prev.length, to: next.length });
  return out;
}

/** "2.1" → "2.2" (minor bump from the highest existing version). */
export function nextVersionLabel(existing: string[]): string {
  let major = 0;
  let minor = 0;
  for (const v of existing) {
    const [a, b] = v.split(".").map(Number);
    if (a! > major || (a === major && b! > minor)) {
      major = a!;
      minor = b!;
    }
  }
  return existing.length ? `${major}.${minor + 1}` : "1.0";
}
