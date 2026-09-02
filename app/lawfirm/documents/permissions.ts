import type { PermissionDefinition } from "../shared/rbac.js";

/**
 * Permissions the Documents module contributes to RBAC (§3.2). File bytes are
 * owned by Core `IFileStorage`; this governs the `case_documents` relationship
 * rows and their metadata.
 */
export const documentPermissions: PermissionDefinition[] = [
  { action: "read", resource: "document", description: "View and download case documents" },
  { action: "upload", resource: "document", description: "Upload a case document" },
  { action: "update", resource: "document", description: "Edit case document metadata / status" },
  { action: "delete", resource: "document", description: "Remove a case document" },
];
