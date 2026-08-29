import type { PermissionDefinition } from "../../rbac/domain/permission.js";

/** Users always manage their own notifications; no elevated permission needed for v0.1. */
export const notificationPermissions: PermissionDefinition[] = [];
