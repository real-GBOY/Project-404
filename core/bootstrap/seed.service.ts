import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "../kernel/db/db.js";
import { runAsSystem } from "../kernel/logging/context.js";
import { UNIT_OF_WORK } from "../kernel/tokens.js";
import type { PermissionDefinition } from "../rbac/domain/permission.js";
import { RbacRepository } from "../rbac/infrastructure/rbac-repository.js";
import { seedRbac } from "../rbac/application/seed.js";
import { TemplateRepository } from "../notifications/infrastructure/template-repository.js";
import { seedTemplates } from "../notifications/templates/seed-templates.js";
import { identityPermissions } from "../identity/permissions/permissions.js";
import { rbacPermissions } from "../rbac/permissions/permissions.js";
import { organizationPermissions } from "../organizations/permissions/permissions.js";
import { auditPermissions } from "../audit/permissions/permissions.js";
import { filePermissions } from "../files/permissions/permissions.js";
import { notificationPermissions } from "../notifications/permissions/permissions.js";

const ALL_PERMISSIONS: PermissionDefinition[] = [
  ...identityPermissions,
  ...rbacPermissions,
  ...organizationPermissions,
  ...auditPermissions,
  ...filePermissions,
  ...notificationPermissions,
];

/**
 * Idempotent seeding — RBAC permissions + the `admin` role, and the bilingual
 * notification templates. Runs system-context (global tables only). Called from
 * `main.ts` on boot and by tests before they exercise the app.
 */
@Injectable()
export class SeedService {
  constructor(
    private readonly rbacRepo: RbacRepository,
    private readonly templates: TemplateRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async seed(): Promise<void> {
    await runAsSystem(async () => {
      await seedRbac(this.rbacRepo, this.uow, ALL_PERMISSIONS);
      await this.uow.transaction(() => this.templates.upsertMany(seedTemplates));
    });
  }
}
