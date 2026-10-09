import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { Conflict, NotFound, ValidationError } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, CLOCK, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IAuditLogger } from "@core/contracts/index.js";
import { can, requireCan, type Access } from "@raqib/raqib/access/access.js";
import { isUniqueViolation } from "@raqib/raqib/shared/pg-errors.js";
import type { L10n } from "@raqib/raqib/shared/l10n.js";
import { BrandingService } from "@raqib/raqib/shared/branding.js";
import { PeopleRepository } from "@raqib/raqib/people/infrastructure/people-repository.js";
import { SettingsService } from "@raqib/raqib/settings/application/settings-service.js";
import { renderBlankFormHtml } from "../domain/blank-form-html.js";
import type { Lang } from "@raqib/raqib/reports/domain/print-kit.js";
import { diffVersions, nextVersionLabel, publishIssues, ITEM_TYPES, type FormChange, type FormSection } from "../domain/form.js";
import { FormsRepository, type FormCategory, type FormRecord, type VersionRecord } from "../infrastructure/forms-repository.js";

export interface VersionView {
  id: string;
  version: string;
  status: "draft" | "published" | "archived";
  note: L10n;
  at: string;
  by: { id: string; name: L10n } | null;
  uses: number;
  sections: FormSection[];
}
export interface FormView {
  id: string;
  code: string;
  category: FormCategory;
  name: L10n;
  description: L10n;
  active: boolean;
  isDefault: boolean;
  updatedAt: string;
  versions: VersionView[];
  /** Draft vs the published version, when a draft exists. */
  diff: FormChange[];
}

@Injectable()
export class FormsService {
  constructor(
    private readonly repo: FormsRepository,
    private readonly people: PeopleRepository,
    private readonly settings: SettingsService,
    private readonly branding: BrandingService,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  /**
   * A blank, printable copy of a form (the published version; a specific version needs the forms right). Anyone who may
   * view visits can print the published form to carry on paper. Audited like a report download.
   */
  async blank(formId: string, lang: Lang, versionId: string | undefined, who: Access): Promise<{ name: string; html: string }> {
    return readInTenant(async () => {
      const form = await this.repo.form(formId);
      if (!form) throw NotFound("raqib.form_not_found", "Form not found.");
      let version: VersionRecord | null;
      if (versionId) {
        requireCan(who, "forms", "V");
        version = await this.repo.version(versionId);
        if (version && version.formId !== formId) version = null;
      } else {
        requireCan(who, "visits", "V");
        version = await this.repo.publishedVersion(formId);
      }
      if (!version) throw NotFound("raqib.version_not_found", "That form has no published version to print.");
      await this.uow.transaction(() =>
        this.audit.record({
          actorId: who.userId,
          action: "raqib.form.blank_printed",
          resourceType: "raqib_form",
          resourceId: formId,
          metadata: { lang, version: version!.version },
        }),
      );
      return {
        name: `${form.code}-v${version.version}-${lang}`,
        html: renderBlankFormHtml({ code: form.code, name: form.name, version: version.version }, version.sections, lang, await this.branding.current()),
      };
    });
  }

  private async assemble(forms: FormRecord[]): Promise<FormView[]> {
    if (!forms.length) return [];
    const [versions, uses] = await Promise.all([this.repo.versions(forms.map((f) => f.id)), this.repo.uses()]);
    const authors = await this.people.findMany([...new Set(versions.map((v) => v.publishedBy ?? v.createdBy).filter((x): x is string => !!x))]);
    const byId = new Map(authors.map((a) => [a.userId, a]));
    return forms.map((f) => {
      const mine = versions.filter((v) => v.formId === f.id);
      const view = (v: VersionRecord): VersionView => {
        const a = byId.get(v.publishedBy ?? v.createdBy ?? "");
        return {
          id: v.id,
          version: v.version,
          status: v.status,
          note: v.note,
          at: (v.publishedAt ?? v.createdAt).toISOString(),
          by: a ? { id: a.userId, name: { ar: a.nameAr, en: a.nameEn } } : null,
          uses: uses.get(v.id) ?? 0,
          sections: v.sections,
        };
      };
      const draft = mine.find((v) => v.status === "draft");
      const pub = mine.find((v) => v.status === "published");
      return {
        id: f.id,
        code: f.code,
        category: f.category,
        name: f.name,
        description: f.description,
        active: f.active,
        isDefault: f.isDefault,
        updatedAt: f.updatedAt.toISOString(),
        versions: mine.map(view).reverse(),
        diff: draft ? diffVersions(pub?.sections ?? null, draft.sections) : [],
      };
    });
  }

  list(who: Access): Promise<FormView[]> {
    requireCan(who, "forms", "V");
    return readInTenant(async () => this.assemble(await this.repo.forms()));
  }

  get(id: string, who: Access): Promise<FormView> {
    requireCan(who, "forms", "V");
    return readInTenant(async () => {
      const f = await this.repo.form(id);
      if (!f) throw NotFound("raqib.form_not_found", "Form not found.");
      return (await this.assemble([f]))[0]!;
    });
  }

  async create(input: { code: string; category: FormCategory; name: L10n; description: L10n }, who: Access): Promise<FormView> {
    requireCan(who, "forms", "A");
    try {
      return await this.uow.transaction(async () => {
        const id = await this.repo.insertForm({ ...input, active: false, isDefault: false, createdBy: who.userId });
        await this.repo.insertVersion({
          formId: id,
          version: "0.1",
          status: "draft",
          sections: [{ key: "s1", title: { ar: "القسم 1", en: "Section 1" }, items: [] }],
          createdBy: who.userId,
        });
        await this.audit.record({ actorId: who.userId, action: "raqib.form.created", resourceType: "raqib_form", resourceId: id, after: input });
        return (await this.assemble([(await this.repo.form(id))!]))[0]!;
      });
    } catch (err) {
      if (isUniqueViolation(err, "raqib_forms_code_uq")) throw Conflict("raqib.form_code_taken", "A form with this code already exists.");
      throw err;
    }
  }

  async updateMeta(id: string, patch: { name?: L10n; description?: L10n }, who: Access): Promise<FormView> {
    requireCan(who, "forms", "E");
    return this.uow.transaction(async () => {
      const f = await this.repo.form(id, true);
      if (!f) throw NotFound("raqib.form_not_found", "Form not found.");
      await this.repo.updateForm(id, patch);
      await this.audit.record({
        actorId: who.userId,
        action: "raqib.form.updated",
        resourceType: "raqib_form",
        resourceId: id,
        before: { name: f.name },
        after: patch,
      });
      return (await this.assemble([(await this.repo.form(id))!]))[0]!;
    });
  }

  /** A new draft copied from the published version (or the latest one), labelled with the next version number. */
  async createDraft(id: string, who: Access): Promise<FormView> {
    requireCan(who, "forms", "E");
    return this.uow.transaction(async () => {
      const f = await this.repo.form(id, true);
      if (!f) throw NotFound("raqib.form_not_found", "Form not found.");
      if (!f.active && (await this.repo.publishedVersion(id))) throw Conflict("raqib.form_inactive", "This form is deactivated.");
      if (await this.repo.draftVersion(id)) throw Conflict("raqib.draft_exists", "This form already has a draft.");
      const all = await this.repo.versions([id]);
      const base = all.find((v) => v.status === "published") ?? all[all.length - 1];
      const label = nextVersionLabel(all.map((v) => v.version));
      await this.repo.insertVersion({ formId: id, version: label, status: "draft", sections: base?.sections ?? [], createdBy: who.userId });
      await this.audit.record({
        actorId: who.userId,
        action: "raqib.form.version_created",
        resourceType: "raqib_form",
        resourceId: id,
        after: { version: label, from: base?.version ?? null },
      });
      return (await this.assemble([f]))[0]!;
    });
  }

  /** Replace the draft's structure. Published and archived versions are rejected here and by a database trigger. */
  async saveDraft(id: string, sections: FormSection[], note: L10n | undefined, who: Access): Promise<FormView> {
    requireCan(who, "forms", "E");
    for (const s of sections) for (const it of s.items) if (!ITEM_TYPES.includes(it.type)) throw ValidationError("raqib.bad_item_type", "Unknown answer type.");
    return this.uow.transaction(async () => {
      const f = await this.repo.form(id, true);
      if (!f) throw NotFound("raqib.form_not_found", "Form not found.");
      const draft = await this.repo.draftVersion(id);
      if (!draft) throw Conflict("raqib.version_locked", "Only a draft can be edited. Create a new version first.");
      await this.repo.updateDraft(draft.id, sections, note);
      await this.audit.record({
        actorId: who.userId,
        action: "raqib.form.draft_saved",
        resourceType: "raqib_form",
        resourceId: id,
        metadata: { version: draft.version },
      });
      return (await this.assemble([f]))[0]!;
    });
  }

  async discardDraft(id: string, who: Access): Promise<FormView> {
    requireCan(who, "forms", "E");
    return this.uow.transaction(async () => {
      const f = await this.repo.form(id, true);
      if (!f) throw NotFound("raqib.form_not_found", "Form not found.");
      const draft = await this.repo.draftVersion(id);
      if (!draft) throw Conflict("raqib.no_draft", "There is no draft to discard.");
      await this.repo.deleteDraft(draft.id);
      await this.audit.record({
        actorId: who.userId,
        action: "raqib.form.draft_discarded",
        resourceType: "raqib_form",
        resourceId: id,
        before: { version: draft.version },
      });
      return (await this.assemble([f]))[0]!;
    });
  }

  /**
   * Publish the draft: it becomes the version new inspections use and the current one is archived. Needs the
   * approve right when the organization requires approval to publish (a setting). Inspections already started
   * stay on the version they started with.
   */
  async publish(id: string, reason: string, who: Access): Promise<FormView> {
    const s = await this.settings.current();
    requireCan(who, "forms", s.insp.publishNeedsApproval ? "P" : "E");
    return this.uow.transaction(async () => {
      const f = await this.repo.form(id, true);
      if (!f) throw NotFound("raqib.form_not_found", "Form not found.");
      const draft = await this.repo.draftVersion(id);
      if (!draft) throw Conflict("raqib.no_draft", "There is no draft to publish.");
      const first = !(await this.repo.publishedVersion(id));
      if (!f.active && !first) throw Conflict("raqib.form_inactive", "This form is deactivated.");
      const issues = publishIssues(draft.sections);
      if (issues.length) throw ValidationError("raqib.form_incomplete", "The draft is not ready to publish.", { issues });
      const now = this.clock.now();
      const current = await this.repo.publishedVersion(id);
      if (current) await this.repo.archive(current.id, now);
      await this.repo.publish(draft.id, who.userId, { ar: reason, en: reason }, now);
      if (first && !f.active) await this.repo.updateForm(id, { active: true });
      if (!(await this.repo.defaultForm(f.category))) {
        await this.repo.clearDefault(f.category);
        await this.repo.updateForm(id, { isDefault: true });
      }
      await this.audit.record({
        actorId: who.userId,
        action: "raqib.form.published",
        resourceType: "raqib_form",
        resourceId: id,
        before: { version: current?.version ?? null },
        after: { version: draft.version },
        metadata: { reason },
      });
      return (await this.assemble([(await this.repo.form(id))!]))[0]!;
    });
  }

  async setActive(id: string, active: boolean, reason: string, who: Access): Promise<FormView> {
    requireCan(who, "forms", "E");
    return this.uow.transaction(async () => {
      const f = await this.repo.form(id, true);
      if (!f) throw NotFound("raqib.form_not_found", "Form not found.");
      if (active && !(await this.repo.publishedVersion(id))) throw Conflict("raqib.no_published_version", "Publish a version before activating this form.");
      await this.repo.updateForm(id, { active, ...(active ? {} : { isDefault: false }) });
      await this.audit.record({
        actorId: who.userId,
        action: active ? "raqib.form.activated" : "raqib.form.deactivated",
        resourceType: "raqib_form",
        resourceId: id,
        metadata: { reason },
      });
      return (await this.assemble([(await this.repo.form(id))!]))[0]!;
    });
  }

  async setDefault(id: string, who: Access): Promise<FormView> {
    requireCan(who, "forms", "P");
    return this.uow.transaction(async () => {
      const f = await this.repo.form(id, true);
      if (!f) throw NotFound("raqib.form_not_found", "Form not found.");
      if (!f.active || !(await this.repo.publishedVersion(id)))
        throw Conflict("raqib.form_not_usable", "Only an active form with a published version can be the default.");
      await this.repo.clearDefault(f.category);
      await this.repo.updateForm(id, { isDefault: true });
      await this.audit.record({
        actorId: who.userId,
        action: "raqib.form.default_set",
        resourceType: "raqib_form",
        resourceId: id,
        metadata: { category: f.category },
      });
      return (await this.assemble([(await this.repo.form(id))!]))[0]!;
    });
  }

  /** Whether the caller may even see the builder's mutating controls (UX hint returned with the list). */
  capabilities(who: Access) {
    return { add: can(who, "forms", "A"), edit: can(who, "forms", "E"), publish: can(who, "forms", "P") };
  }
}
