import type { PermissionDefinition } from "@hotel/hotel/shared/rbac.js";

export const billingPermissions: PermissionDefinition[] = [
  { action: "read", resource: "folio", description: "View a guest's folio, balance and payments." },
  {
    action: "post",
    resource: "charge",
    description: "Post extras (breakfast, minibar, …) to a folio.",
  },
  {
    action: "void",
    resource: "charge",
    description: "Void a folio charge that is not yet invoiced.",
  },
  { action: "create", resource: "payment", description: "Take payments." },
  { action: "read", resource: "invoice", description: "View invoices." },
];
