import type { PermissionDefinition } from "@hotel/hotel/shared/rbac.js";

/**
 * Every permission the hotel domain contributes to Core RBAC, seeded by `AppSeedService` on boot
 * so `can(user, "<action>", "<resource>")` resolves. Each feature module keeps its own
 * `permissions/permissions.ts`; this is the aggregate — mirrors
 * `atlas/backend/app/realestate/permissions.ts`. Empty until the first feature module lands.
 */
export const HOTEL_PERMISSIONS: PermissionDefinition[] = [];
