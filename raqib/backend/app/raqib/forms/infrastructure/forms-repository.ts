import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { getContext } from "@core/kernel/logging/context.js";
import { raqibDb } from "@raqib/raqib/db/executor.js";
import { raqibId } from "@raqib/raqib/shared/ids.js";
import type { L10n } from "@raqib/raqib/shared/l10n.js";
import type { FormSection } from "../domain/form.js";

export type FormCategory = "site" | "guard";
export type VersionStatus = "draft" | "published" | "archived";

export interface FormRecord {
  id: string;
  code: string;
  category: FormCategory;
  name: L10n;
  description: L10n;
  active: boolean;
  isDefault: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}
export interface VersionRecord {
  id: string;
  formId: string;
  version: string;
  status: VersionStatus;
  sections: FormSection[];
  note: L10n;
  createdBy: string | null;
  createdAt: Date;
  publishedBy: string | null;
  publishedAt: Date | null;
  supersededAt: Date | null;
}

const org = (): string => {
  const id = getContext()?.organizationId;
  if (!id) throw new Error("forms repository used outside a tenant context");
  return id;
};

type FormRow = {
  id: string;
  code: string;
  category: FormCategory;
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
  active: boolean;
  is_default: boolean;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
};
const toForm = (r: FormRow): FormRecord => ({
  id: r.id,
  code: r.code,
  category: r.category,
  name: { ar: r.name_ar, en: r.name_en },
  description: { ar: r.description_ar, en: r.description_en },
  active: r.active,
  isDefault: r.is_default,
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
type VerRow = {
  id: string;
  form_id: string;
  version: string;
  status: VersionStatus;
  sections: unknown;
  note_ar: string;
  note_en: string;
  created_by: string | null;
  created_at: Date;
  published_by: string | null;
  published_at: Date | null;
  superseded_at: Date | null;
};
const toVersion = (r: VerRow): VersionRecord => ({
  id: r.id,
  formId: r.form_id,
  version: r.version,
  status: r.status,
  sections: r.sections as FormSection[],
  note: { ar: r.note_ar, en: r.note_en },
  createdBy: r.created_by,
  createdAt: r.created_at,
  publishedBy: r.published_by,
  publishedAt: r.published_at,
  supersededAt: r.superseded_at,
});

@Injectable()
export class FormsRepository {
  async forms(): Promise<FormRecord[]> {
    return (await raqibDb().selectFrom("raqib_forms").selectAll().orderBy("category").orderBy("code").execute()).map(toForm);
  }

  async form(id: string, lock = false): Promise<FormRecord | null> {
    let q = raqibDb().selectFrom("raqib_forms").selectAll().where("id", "=", id);
    if (lock) q = q.forUpdate();
    const r = await q.executeTakeFirst();
    return r ? toForm(r) : null;
  }

  async insertForm(f: {
    code: string;
    category: FormCategory;
    name: L10n;
    description: L10n;
    active: boolean;
    isDefault: boolean;
    createdBy: string | null;
  }): Promise<string> {
    const id = raqibId("frm");
    await raqibDb()
      .insertInto("raqib_forms")
      .values({
        id,
        organization_id: org(),
        code: f.code,
        category: f.category,
        name_ar: f.name.ar,
        name_en: f.name.en,
        description_ar: f.description.ar,
        description_en: f.description.en,
        active: f.active,
        is_default: f.isDefault,
        created_by: f.createdBy,
      })
      .execute();
    return id;
  }

  async updateForm(id: string, patch: Partial<{ name: L10n; description: L10n; active: boolean; isDefault: boolean }>): Promise<void> {
    const set: Record<string, unknown> = { updated_at: sql`now()` };
    if (patch.name) {
      set.name_ar = patch.name.ar;
      set.name_en = patch.name.en;
    }
    if (patch.description) {
      set.description_ar = patch.description.ar;
      set.description_en = patch.description.en;
    }
    if (patch.active !== undefined) set.active = patch.active;
    if (patch.isDefault !== undefined) set.is_default = patch.isDefault;
    await raqibDb()
      .updateTable("raqib_forms")
      .set(set as never)
      .where("id", "=", id)
      .execute();
  }

  /** Clear the category's default so another form can take it (the unique index allows only one). */
  async clearDefault(category: FormCategory): Promise<void> {
    await raqibDb().updateTable("raqib_forms").set({ is_default: false }).where("category", "=", category).where("is_default", "=", true).execute();
  }

  async defaultForm(category: FormCategory): Promise<FormRecord | null> {
    const r = await raqibDb()
      .selectFrom("raqib_forms")
      .selectAll()
      .where("category", "=", category)
      .where("is_default", "=", true)
      .where("active", "=", true)
      .executeTakeFirst();
    return r ? toForm(r) : null;
  }

  // ── versions ────────────────────────────────────────────────────────────

  async versions(formIds?: string[]): Promise<VersionRecord[]> {
    let q = raqibDb().selectFrom("raqib_form_versions").selectAll();
    if (formIds) q = q.where("form_id", "in", formIds.length ? formIds : ["-"]);
    return (await q.orderBy("created_at").execute()).map(toVersion);
  }

  async version(id: string, lock = false): Promise<VersionRecord | null> {
    let q = raqibDb().selectFrom("raqib_form_versions").selectAll().where("id", "=", id);
    if (lock) q = q.forUpdate();
    const r = await q.executeTakeFirst();
    return r ? toVersion(r) : null;
  }

  async publishedVersion(formId: string): Promise<VersionRecord | null> {
    const r = await raqibDb().selectFrom("raqib_form_versions").selectAll().where("form_id", "=", formId).where("status", "=", "published").executeTakeFirst();
    return r ? toVersion(r) : null;
  }

  async draftVersion(formId: string): Promise<VersionRecord | null> {
    const r = await raqibDb().selectFrom("raqib_form_versions").selectAll().where("form_id", "=", formId).where("status", "=", "draft").executeTakeFirst();
    return r ? toVersion(r) : null;
  }

  async insertVersion(v: {
    formId: string;
    version: string;
    status: VersionStatus;
    sections: FormSection[];
    note?: L10n;
    createdBy: string | null;
    publishedAt?: Date | null;
  }): Promise<string> {
    const id = raqibId("fvr");
    await raqibDb()
      .insertInto("raqib_form_versions")
      .values({
        id,
        organization_id: org(),
        form_id: v.formId,
        version: v.version,
        status: v.status,
        sections: JSON.stringify(v.sections) as never,
        note_ar: v.note?.ar ?? "",
        note_en: v.note?.en ?? "",
        created_by: v.createdBy,
        published_by: v.status === "published" ? v.createdBy : null,
        published_at: v.status === "published" ? (v.publishedAt ?? new Date()) : null,
      })
      .execute();
    return id;
  }

  async updateDraft(id: string, sections: FormSection[], note?: L10n): Promise<void> {
    const set: Record<string, unknown> = { sections: JSON.stringify(sections) };
    if (note) {
      set.note_ar = note.ar;
      set.note_en = note.en;
    }
    await raqibDb()
      .updateTable("raqib_form_versions")
      .set(set as never)
      .where("id", "=", id)
      .execute();
  }

  async publish(id: string, by: string, note: L10n, at: Date): Promise<void> {
    await raqibDb()
      .updateTable("raqib_form_versions")
      .set({ status: "published", published_by: by, published_at: at, note_ar: note.ar, note_en: note.en })
      .where("id", "=", id)
      .execute();
  }

  async archive(id: string, at: Date): Promise<void> {
    await raqibDb().updateTable("raqib_form_versions").set({ status: "archived", superseded_at: at }).where("id", "=", id).execute();
  }

  async deleteDraft(id: string): Promise<void> {
    await raqibDb().deleteFrom("raqib_form_versions").where("id", "=", id).where("status", "=", "draft").execute();
  }

  /** How many inspections ran on each version (the "bound inspections" count shown in the builder). */
  async uses(): Promise<Map<string, number>> {
    const rows = await raqibDb()
      .selectFrom("raqib_inspections")
      .select(["form_version_id", sql<number>`count(*)::int`.as("n")])
      .groupBy("form_version_id")
      .execute();
    const guard = await raqibDb()
      .selectFrom("raqib_inspections")
      .select(["guard_form_version_id", sql<number>`count(*)::int`.as("n")])
      .where("guard_form_version_id", "is not", null)
      .groupBy("guard_form_version_id")
      .execute();
    const out = new Map<string, number>(rows.map((r) => [r.form_version_id, r.n]));
    for (const g of guard) out.set(g.guard_form_version_id!, (out.get(g.guard_form_version_id!) ?? 0) + g.n);
    return out;
  }
}
