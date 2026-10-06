import { randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { currentExecutor, unitOfWork, type UnitOfWork } from "@core/kernel/db/db.js";
import { Conflict, ValidationError } from "@core/kernel/errors.js";
import { newId } from "@core/kernel/id.js";
import { runAsSystem, withContext } from "@core/kernel/logging/context.js";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import { getConfig } from "@core/kernel/config.js";
import { CLOCK, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import { argon2Hasher } from "@core/identity/infrastructure/password-hasher.js";
import { VerificationTokenRepository } from "@core/identity/infrastructure/verification-token-repository.js";
import { RbacService } from "@core/rbac/application/rbac-service.js";
import { PeopleRepository } from "@raqib/raqib/people/infrastructure/people-repository.js";
import { FormsRepository } from "@raqib/raqib/forms/infrastructure/forms-repository.js";
import { SettingsRepository } from "@raqib/raqib/settings/infrastructure/settings-repository.js";
import { DEFAULT_SETTINGS, type OrgSettings } from "@raqib/raqib/settings/domain/defaults.js";
import { DEMO_FORMS } from "@raqib/raqib/demo/demo-forms.js";
import { coreRoleKey } from "@raqib/raqib/shared/roles.js";
import type { RoleKey } from "@raqib/raqib/shared/modules.js";

const log = moduleLogger("raqib-provisioning");

const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SETUP_TTL_SECONDS = 7 * 24 * 3600;

export interface ProvisionInput {
  /** Company name (English); `nameAr` defaults to it. */
  name: string;
  nameAr?: string;
  /** URL-safe tenant key used by the public account-request page. */
  slug: string;
  ownerEmail: string;
  ownerName: string;
  ownerNameAr?: string;
  /** The first administrator role; the quality manager by default. People of other roles are added through account requests. */
  ownerRole?: Extract<RoleKey, "qm" | "gm">;
  city?: { ar: string; en: string };
  /** Install the starter inspection forms (published, default). On by default. */
  starterForms?: boolean;
}

export interface ProvisionResult {
  organizationId: string;
  slug: string;
  ownerUserId: string;
  /** One-time link that lets the owner choose a password. Shown once; only its hash is stored. */
  setupLink: string;
  setupLinkExpiresAt: string;
}

/**
 * Creates a customer: the organization (tenant), its first administrator, default settings and the starter forms,
 * all through the same repositories the product uses. This is the supported way to onboard a real company; the
 * demo seeder is for fictional data only. Not idempotent on purpose: an existing slug or owner e-mail is refused.
 */
@Injectable()
export class ProvisioningService {
  constructor(
    private readonly rbac: RbacService,
    private readonly people: PeopleRepository,
    private readonly forms: FormsRepository,
    private readonly settings: SettingsRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async provision(input: ProvisionInput): Promise<ProvisionResult> {
    const slug = input.slug.trim().toLowerCase();
    const email = input.ownerEmail.trim();
    const name = input.name.trim();
    const ownerName = input.ownerName.trim();
    if (!SLUG.test(slug)) throw ValidationError("raqib.invalid_slug", "The slug must be 3–40 lowercase letters, digits or hyphens.");
    if (!EMAIL.test(email)) throw ValidationError("raqib.invalid_email", "The owner e-mail is not valid.");
    if (name.length < 2 || ownerName.length < 2) throw ValidationError("raqib.invalid_name", "Company and owner names are required.");
    const role = input.ownerRole ?? "qm";
    const now = this.clock.now();
    const orgId = newId("org");
    const userId = newId("usr");
    const unusable = await argon2Hasher.hash(randomBytes(32).toString("base64url"));

    await runAsSystem(() =>
      unitOfWork.transaction(async () => {
        const ex = currentExecutor();
        if (await ex.selectFrom("organizations").select("id").where("slug", "=", slug).executeTakeFirst())
          throw Conflict("raqib.slug_taken", `An organization with the slug "${slug}" already exists.`);
        if (await ex.selectFrom("users").select("id").where("email_normalized", "=", email.toLowerCase()).executeTakeFirst())
          throw Conflict("raqib.email_taken", "An account with this e-mail already exists.");
        await ex.insertInto("organizations").values({ id: orgId, name, slug, settings: {} }).execute();
        await ex
          .insertInto("users")
          .values({
            id: userId,
            email,
            email_normalized: email.toLowerCase(),
            password_hash: unusable,
            display_name: ownerName,
            status: "active",
            email_verified_at: now,
            locale: "ar",
          })
          .execute();
        await ex
          .insertInto("organization_members")
          .values({ id: newId("mem"), organization_id: orgId, user_id: userId, membership_role: "owner" })
          .execute();
      }),
    );
    await runAsSystem(() => this.rbac.assignRole(userId, coreRoleKey(role), userId, orgId));

    await withContext({ userId, organizationId: orgId }, () =>
      this.uow.transaction(async () => {
        const settings: OrgSettings = {
          ...DEFAULT_SETTINGS,
          org: {
            ...DEFAULT_SETTINGS.org,
            nameEn: name,
            nameAr: input.nameAr?.trim() || name,
            cr: "",
            cityAr: input.city?.ar ?? DEFAULT_SETTINGS.org.cityAr,
            cityEn: input.city?.en ?? DEFAULT_SETTINGS.org.cityEn,
          },
        };
        await this.settings.save(settings, userId);
        await this.people.insert({
          userId,
          roleKey: role,
          nameAr: input.ownerNameAr?.trim() || ownerName,
          nameEn: ownerName,
          titleAr: role === "gm" ? "المدير العام" : "مدير إدارة الجودة",
          titleEn: role === "gm" ? "General Manager" : "Director of Quality",
          employeeNo: null,
          status: "active",
        });
        if (input.starterForms !== false) await this.installStarterForms(userId);
      }),
    );

    const token = await runAsSystem(() =>
      this.uow.transaction(() => new VerificationTokenRepository(this.clock).issue({ userId, purpose: "password_reset", ttlSeconds: SETUP_TTL_SECONDS })),
    );
    log.info({ organizationId: orgId, slug, ownerUserId: userId }, "organization provisioned");
    return {
      organizationId: orgId,
      slug,
      ownerUserId: userId,
      setupLink: `${getConfig().appUrl}/reset-password?token=${encodeURIComponent(token)}`,
      setupLinkExpiresAt: new Date(now.getTime() + SETUP_TTL_SECONDS * 1000).toISOString(),
    };
  }

  /** The published, default form of each category from the product's reference set, as version 1.0. */
  private async installStarterForms(actorId: string): Promise<void> {
    for (const f of DEMO_FORMS.filter((x) => x.isDefault && x.active)) {
      const published = [...f.versions].reverse().find((v) => v.status !== "draft");
      if (!published) continue;
      const formId = await this.forms.insertForm({
        code: f.code,
        category: f.category,
        name: f.name,
        description: f.description,
        active: true,
        isDefault: true,
        createdBy: actorId,
      });
      await this.forms.insertVersion({ formId, version: "1.0", status: "published", sections: published.sections, note: published.note, createdBy: actorId });
    }
  }
}
