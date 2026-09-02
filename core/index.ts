/**
 * AURIC Core public surface. A client project imports the feature `@Module`s it
 * needs into its own `AppModule`, and injects the Core contracts by token.
 * See docs/integration-guide.md.
 */
export { AppModule } from "./app.module.js";
export { CORE_VERSION } from "./version.js";

export { KernelModule } from "@core/kernel/kernel.module.js";
export { EventsModule } from "@core/events/events.module.js";
export { AuditModule } from "@core/audit/audit.module.js";
export { RbacModule } from "@core/rbac/rbac.module.js";
export { IdentityModule } from "@core/identity/identity.module.js";
export { OrganizationsModule } from "@core/organizations/organizations.module.js";
export { NotificationsModule } from "@core/notifications/notifications.module.js";
export { FilesModule } from "@core/files/files.module.js";
export { SecurityModule } from "@core/http/security.module.js";
export { SeedService } from "@core/bootstrap/seed.service.js";
export { migrateToLatest, migrationStatus } from "@core/kernel/db/migrate.js";

export * from "@core/kernel/tokens.js";
export type * from "@core/contracts/index.js";
export {
  currentOrganizationId,
  requireOrganizationId,
  isSystemContext,
  tenantContext,
} from "@core/kernel/tenant.js";
