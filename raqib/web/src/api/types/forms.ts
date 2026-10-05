/** Inspection forms, versions and what changed between them. */
import type { L10n } from "./common";

export type ItemType = "cnx" | "yesno" | "number" | "text" | "select" | "date" | "scale5";

export interface FormItem {
  key: string;
  text: L10n;
  weight: number;
  type: ItemType;
  required: boolean;
  na: boolean;
  evidenceOnNc: boolean;
}

export interface FormSection {
  key: string;
  title: L10n;
  items: FormItem[];
}

export type FormChange =
  | { kind: "added"; num: string; text: L10n }
  | { kind: "removed"; num: string; text: L10n }
  | { kind: "weight"; num: string; from: number; to: number }
  | { kind: "text"; num: string }
  | { kind: "rules"; num: string }
  | { kind: "sections"; from: number; to: number };

export interface FormVersion {
  id: string;
  version: string;
  status: "draft" | "published" | "archived";
  note: L10n;
  at: string;
  by: { id: string; name: L10n } | null;
  uses: number;
  sections: FormSection[];
}

export interface Form {
  id: string;
  code: string;
  category: "site" | "guard";
  name: L10n;
  description: L10n;
  active: boolean;
  isDefault: boolean;
  updatedAt: string;
  versions: FormVersion[];
  diff: FormChange[];
}
