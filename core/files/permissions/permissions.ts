/** @format */

import type { PermissionDefinition } from "@core/rbac/domain/permission.js";

export const filePermissions: PermissionDefinition[] = [
  { action: "upload", resource: "file", description: "Upload files" },
  { action: "read", resource: "file", description: "Download any file" },
  { action: "delete", resource: "file", description: "Delete any file" },
];
