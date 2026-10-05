import { Forbidden } from "@core/kernel/errors.js";
import { ALL_PROJECT_ROLES, type ModuleKey, type RoleKey, type Template } from "@raqib/raqib/shared/modules.js";
import type { IsoDate } from "@raqib/raqib/shared/dates.js";

/**
 * The resolved authority of the caller for one request: who they are, what their organization's
 * permission template grants their role, and which projects they may touch. Built once per request
 * by `AccessService.resolve` from LIVE data (never from token claims), and handed to application
 * services, which re-check object-level rules — the template alone is never enough.
 */
export interface Access {
  userId: string;
  organizationId: string;
  role: RoleKey;
  /** Names/titles as they are now — snapshot into decisions when acting. */
  nameAr: string;
  nameEn: string;
  titleAr: string;
  titleEn: string;
  template: Template;
  /** `all` for roles whose scope is every project; otherwise the active assigned project ids. */
  allProjects: boolean;
  projectIds: ReadonlySet<string>;
  today: IsoDate;
}

export const can = (a: Access, module: ModuleKey, letter: string): boolean =>
  a.template[module].includes(letter);

export function requireCan(a: Access, module: ModuleKey, letter: string): void {
  if (!can(a, module, letter)) {
    throw Forbidden("raqib.forbidden", `Your role is not permitted to do this (${module}:${letter}).`);
  }
}

export const inScope = (a: Access, projectId: string): boolean =>
  a.allProjects || a.projectIds.has(projectId);

/** Object-level project check. The response never says whether the project exists. */
export function requireProject(a: Access, projectId: string, ref?: string): void {
  if (!inScope(a, projectId)) {
    throw Forbidden("raqib.out_of_scope", "This resource is outside your project scope.");
  }
  void ref;
}

export const rolesWithAllProjects = ALL_PROJECT_ROLES;

/** Snapshot of who acted, written into history rows so later renames or role changes never rewrite the past. */
export const actorOf = (a: Access) => ({
  actorId: a.userId as string | null,
  actorNameAr: a.nameAr,
  actorNameEn: a.nameEn,
  actorRole: a.role as string | null,
  actorTitleAr: a.titleAr,
  actorTitleEn: a.titleEn,
});

/** The system actor (scheduled jobs). */
export const SYSTEM_ACTOR = {
  actorId: null as string | null,
  actorNameAr: "النظام",
  actorNameEn: "System",
  actorRole: null as string | null,
  actorTitleAr: "",
  actorTitleEn: "",
};
