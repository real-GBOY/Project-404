import type { PermissionDefinition } from "@atlas/realestate/shared/rbac.js";
import { propertiesPermissions } from "@atlas/realestate/properties/permissions/permissions.js";
import { crmPermissions } from "@atlas/realestate/crm/permissions/permissions.js";
import { salesPermissions } from "@atlas/realestate/sales/permissions/permissions.js";
import { financePermissions } from "@atlas/realestate/finance/permissions/permissions.js";
import { operationsPermissions } from "@atlas/realestate/operations/permissions/permissions.js";
import { assistantPermissions } from "@atlas/realestate/assistant/permissions/permissions.js";
import { adminPermissions } from "@atlas/realestate/admin/permissions/permissions.js";
import { dashboardPermissions } from "@atlas/realestate/dashboard/permissions/permissions.js";

/**
 * Every permission the real-estate domain contributes to Core RBAC. Seeded by
 * `AppSeedService` on boot so `can(user, "<action>", "<resource>")` resolves.
 * Each module keeps its own `permissions.ts`; this is the aggregate — mirrors
 * `mizan/backend/app/lawfirm/permissions.ts`.
 */
export const REALESTATE_PERMISSIONS: PermissionDefinition[] = [
  ...propertiesPermissions,
  ...crmPermissions,
  ...salesPermissions,
  ...financePermissions,
  ...operationsPermissions,
  ...assistantPermissions,
  ...adminPermissions,
  ...dashboardPermissions,
];
