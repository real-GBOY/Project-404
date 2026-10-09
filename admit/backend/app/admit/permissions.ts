import type { PermissionDefinition } from "@admit/admit/shared/rbac.js";
import { eventsPermissions } from "@admit/admit/events/permissions/permissions.js";
import { bookingsPermissions } from "@admit/admit/bookings/permissions/permissions.js";
import { paymentsPermissions } from "@admit/admit/payments/permissions/permissions.js";
import { ticketsPermissions } from "@admit/admit/tickets/permissions/permissions.js";
import { checkinPermissions } from "@admit/admit/checkin/permissions/permissions.js";
import { reportsPermissions } from "@admit/admit/reports/permissions/permissions.js";
import { emailsPermissions } from "@admit/admit/emails/permissions/permissions.js";
import { staffPermissions } from "@admit/admit/staff/permissions/permissions.js";
import { settingsPermissions } from "@admit/admit/settings/permissions/permissions.js";

/**
 * Every permission the Admit domain contributes to Core RBAC, seeded by `AppSeedService` on boot
 * so `can(user, "<action>", "<resource>")` resolves. Each feature module keeps its own
 * `permissions/permissions.ts`; this is the aggregate - mirrors `hotel-project/backend/app/hotel/permissions.ts`.
 */
export const ADMIT_PERMISSIONS: PermissionDefinition[] = [
  ...eventsPermissions,
  ...bookingsPermissions,
  ...paymentsPermissions,
  ...ticketsPermissions,
  ...checkinPermissions,
  ...reportsPermissions,
  ...emailsPermissions,
  ...staffPermissions,
  ...settingsPermissions,
];
