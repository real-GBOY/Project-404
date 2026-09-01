/**
 * AURIC Core public surface. A client project imports the feature `@Module`s it
 * needs into its own `AppModule`, and injects the Core contracts by token.
 * See docs/integration-guide.md.
 */
export { AppModule } from "./app.module.js";
export { CORE_VERSION } from "./version.js";

export { KernelModule } from "./kernel/kernel.module.js";
export { EventsModule } from "./events/events.module.js";
export { AuditModule } from "./audit/audit.module.js";
export { RbacModule } from "./rbac/rbac.module.js";
export { IdentityModule } from "./identity/identity.module.js";
export { OrganizationsModule } from "./organizations/organizations.module.js";
export { NotificationsModule } from "./notifications/notifications.module.js";
export { FilesModule } from "./files/files.module.js";
export { SecurityModule } from "./http/security.module.js";
export { SeedService } from "./bootstrap/seed.service.js";
export { migrateToLatest, migrationStatus } from "./kernel/db/migrate.js";

export * from "./kernel/tokens.js";
export type * from "./contracts/index.js";
export {
  currentOrganizationId,
  requireOrganizationId,
  isSystemContext,
  tenantContext,
} from "./kernel/tenant.js";
