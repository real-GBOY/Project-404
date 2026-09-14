import type { PermissionDefinition } from "@atlas/realestate/shared/rbac.js";

export const financePermissions: PermissionDefinition[] = [
  { action: "read", resource: "payment", description: "View payments, collections and outstanding balances." },
  { action: "record", resource: "payment", description: "Record a payment." },
  { action: "read", resource: "financial_report", description: "View saved financial reports." },
  { action: "create", resource: "financial_report", description: "Create/schedule a financial report." },
];
