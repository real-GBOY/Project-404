import { Injectable } from "@nestjs/common";
import { readInTenant } from "@core/kernel/db/db.js";
import { Forbidden } from "@core/kernel/errors.js";
import type { Principal } from "@core/http/principal.js";
import { SettingsService } from "@raqib/raqib/settings/application/settings-service.js";
import {
  ALL_PROJECT_ROLES,
  APPLICABLE,
  DEFAULT_TEMPLATES,
  MODULES,
  isModule,
  type ModuleKey,
  type RoleKey,
  type Template,
} from "@raqib/raqib/shared/modules.js";
import type { Access } from "../access.js";
import { AccessRepository } from "../infrastructure/access-repository.js";

/** Default template for a role with the organization's overrides applied (inapplicable letters dropped). */
export function effectiveTemplate(role: RoleKey, overrides: Array<{ module: string; actions: string }>): Template {
  const t: Template = { ...DEFAULT_TEMPLATES[role] };
  for (const o of overrides) {
    if (!isModule(o.module)) continue;
    const allowed = APPLICABLE[o.module as ModuleKey];
    t[o.module] = [...o.actions].filter((c) => allowed.includes(c)).join("");
  }
  return t;
}

@Injectable()
export class AccessService {
  constructor(
    private readonly repo: AccessRepository,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Resolve the caller's live authority. A person with no Raqib profile, or whose profile is not
   * active, has no access at all — even with a valid token (the token only proves identity).
   */
  async resolve(principal: Principal): Promise<Access> {
    if (!principal.organizationId) throw Forbidden("raqib.no_organization", "No active organization.");
    const orgId = principal.organizationId;
    return readInTenant(async () => {
      const profile = await this.repo.profile(principal.userId);
      if (!profile) throw Forbidden("raqib.no_profile", "This account has no Raqib profile.");
      if (profile.status === "disabled") throw Forbidden("raqib.account_disabled", "This account is disabled.");
      if (profile.status === "invited") throw Forbidden("raqib.account_inactive", "This account is not activated yet.");
      const today = await this.settings.today();
      const overrides = await this.repo.templateOverrides(profile.roleKey);
      const allProjects = ALL_PROJECT_ROLES.includes(profile.roleKey);
      const projectIds = allProjects ? [] : await this.repo.activeProjectIds(principal.userId, today);
      return {
        userId: principal.userId,
        organizationId: orgId,
        role: profile.roleKey,
        nameAr: profile.nameAr,
        nameEn: profile.nameEn,
        titleAr: profile.titleAr,
        titleEn: profile.titleEn,
        template: effectiveTemplate(profile.roleKey, overrides),
        allProjects,
        projectIds: new Set(projectIds),
        today,
      };
    });
  }

  /**
   * Everyone who may do `letter` on `module` for a project, by LIVE template + scope (never by role name).
   * Used to choose notification recipients so nobody is told about something they could not open.
   */
  async holders(module: ModuleKey, letter: string, projectId: string | null, today: string, exclude?: string | null): Promise<string[]> {
    return readInTenant(async () => {
      const [profiles, overrides, assignments] = await Promise.all([this.repo.allProfiles(), this.repo.allOverrides(), this.repo.activeAssignments(today)]);
      const tpl = new Map<RoleKey, Template>();
      for (const role of Object.keys(DEFAULT_TEMPLATES) as RoleKey[]) {
        tpl.set(role, effectiveTemplate(role, overrides.filter((o) => o.role_key === role)));
      }
      return profiles
        .filter((p) => p.status === "active" && p.userId !== exclude && tpl.get(p.roleKey)![module].includes(letter))
        .filter((p) => !projectId || ALL_PROJECT_ROLES.includes(p.roleKey) || assignments.some((a) => a.userId === p.userId && a.projectId === projectId))
        .map((p) => p.userId);
    });
  }

  /** The effective templates of every role (for the permission-templates screen). */
  async allTemplates(): Promise<Record<RoleKey, Template>> {
    return readInTenant(async () => {
      const out = {} as Record<RoleKey, Template>;
      for (const role of Object.keys(DEFAULT_TEMPLATES) as RoleKey[]) {
        out[role] = effectiveTemplate(role, await this.repo.templateOverrides(role));
      }
      return out;
    });
  }
}

export { MODULES };
