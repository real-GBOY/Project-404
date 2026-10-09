import type { PermissionDefinition } from "@admit/admit/shared/rbac.js";

export const checkinPermissions: PermissionDefinition[] = [
  { action: "scan", resource: "checkin", description: "Scan tickets at the door of assigned events." },
  { action: "read", resource: "checkin", description: "See check-in counts, arrivals and the scan log." },
];
