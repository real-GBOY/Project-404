import type { PermissionDefinition } from "@hotel/hotel/shared/rbac.js";
import { settingsPermissions } from "@hotel/hotel/settings/permissions/permissions.js";
import { staffPermissions } from "@hotel/hotel/staff/permissions/permissions.js";
import { roomsPermissions } from "@hotel/hotel/rooms/permissions/permissions.js";
import { guestsPermissions } from "@hotel/hotel/guests/permissions/permissions.js";

/**
 * Every permission the hotel domain contributes to Core RBAC, seeded by `AppSeedService` on boot
 * so `can(user, "<action>", "<resource>")` resolves. Each feature module keeps its own
 * `permissions/permissions.ts`; this is the aggregate — mirrors
 * `atlas/backend/app/realestate/permissions.ts`.
 */
export const HOTEL_PERMISSIONS: PermissionDefinition[] = [
  ...settingsPermissions,
  ...staffPermissions,
  ...roomsPermissions,
  ...guestsPermissions,
];
