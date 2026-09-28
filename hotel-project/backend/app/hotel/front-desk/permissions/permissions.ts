import type { PermissionDefinition } from "@hotel/hotel/shared/rbac.js";

export const frontDeskPermissions: PermissionDefinition[] = [
  { action: "check_in", resource: "reservation", description: "Check guests in." },
  {
    action: "check_out",
    resource: "reservation",
    description: "Check guests out (settles the folio and issues the invoice).",
  },
];
