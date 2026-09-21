import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { runAsSystem } from "@core/kernel/logging/context.js";
import { UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { PermissionDefinition } from "@core/rbac/domain/permission.js";
import { RbacRepository } from "@core/rbac/infrastructure/rbac-repository.js";
import { seedRbac } from "@core/rbac/application/seed.js";
// @auric-begin notifications
import { TemplateRepository } from "@core/notifications/infrastructure/template-repository.js";
// @auric-end notifications
// @auric-begin notifications
import { seedTemplates } from "@core/notifications/templates/seed-templates.js";
// @auric-end notifications
import { identityPermissions } from "@core/identity/permissions/permissions.js";
import { rbacPermissions } from "@core/rbac/permissions/permissions.js";
import { organizationPermissions } from "@core/organizations/permissions/permissions.js";
import { auditPermissions } from "@core/audit/permissions/permissions.js";
// @auric-begin files
import { filePermissions } from "@core/files/permissions/permissions.js";
// @auric-end files
// @auric-begin notifications
import { notificationPermissions } from "@core/notifications/permissions/permissions.js";
// @auric-end notifications
// @auric-begin messaging
import { messagingPermissions } from "@core/messaging/permissions/permissions.js";
// @auric-end messaging

const ALL_PERMISSIONS: PermissionDefinition[] = [
  ...identityPermissions,
  ...rbacPermissions,
  ...organizationPermissions,
  ...auditPermissions,
  // @auric-begin files
  ...filePermissions,
  // @auric-end files
  // @auric-begin notifications
  ...notificationPermissions,
  // @auric-end notifications
  // @auric-begin messaging
  ...messagingPermissions,
  // @auric-end messaging
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
    // @auric-begin notifications
    private readonly templates: TemplateRepository,
    // @auric-end notifications
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async seed(): Promise<void> {
    await runAsSystem(async () => {
      await seedRbac(this.rbacRepo, this.uow, ALL_PERMISSIONS);
      // @auric-begin notifications
      await this.uow.transaction(() => this.templates.upsertMany(seedTemplates));
      // @auric-end notifications
    });
  }
}
