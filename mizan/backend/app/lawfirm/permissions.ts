import type { PermissionDefinition } from "@app/lawfirm/shared/rbac.js";
import { clientPermissions } from "@app/lawfirm/clients/permissions.js";
import { matterPermissions } from "@app/lawfirm/matters/permissions.js";
import { hearingPermissions } from "@app/lawfirm/hearings/permissions.js";
import { taskPermissions } from "@app/lawfirm/tasks/permissions.js";
import { documentPermissions } from "@app/lawfirm/documents/permissions.js";
import { billingPermissions } from "@app/lawfirm/billing/permissions.js";
import { staffPermissions } from "@app/lawfirm/staff/permissions.js";
import { settingsPermissions } from "@app/lawfirm/settings/permissions.js";
import { dashboardPermissions } from "@app/lawfirm/dashboard/permissions.js";
import { calendarPermissions } from "@app/lawfirm/calendar/permissions.js";

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
  ...calendarPermissions,
];
