import type { RoleSeed } from "./rbac.js";

/**
 * Global roles HotelOS seeds into Core RBAC (roles are global; only `user_roles` assignments are
 * tenant-scoped). Domain code never branches on a role key, only on permissions. The hotel roles
 * (owner, manager, receptionist, accountant, housekeeping, maintenance) are defined together
 * with the permissions they grant, starting with the first feature module.
 */
export const HOTEL_ROLES: RoleSeed[] = [];
