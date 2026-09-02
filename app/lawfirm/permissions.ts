import type { PermissionDefinition } from "./shared/rbac.js";
import { clientPermissions } from "./clients/permissions.js";
import { matterPermissions } from "./matters/permissions.js";
import { hearingPermissions } from "./hearings/permissions.js";
import { taskPermissions } from "./tasks/permissions.js";
import { documentPermissions } from "./documents/permissions.js";
import { billingPermissions } from "./billing/permissions.js";
import { staffPermissions } from "./staff/permissions.js";
import { settingsPermissions } from "./settings/permissions.js";
import { dashboardPermissions } from "./dashboard/permissions.js";

/**
 * Every permission the law-firm domain contributes to Core RBAC. Seeded by
 * `AppSeedService` on boot so `can(user, "<action>", "<resource>")` resolves.
 * Each module keeps its own `permissions.ts`; this is the aggregate.
 */
export const LAWFIRM_PERMISSIONS: PermissionDefinition[] = [
  ...clientPermissions,
  ...matterPermissions,
  ...hearingPermissions,
  ...taskPermissions,
  ...documentPermissions,
  ...billingPermissions,
  ...staffPermissions,
  ...settingsPermissions,
  ...dashboardPermissions,
];
