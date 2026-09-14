import type { PermissionDefinition } from "@atlas/realestate/shared/rbac.js";

export const salesPermissions: PermissionDefinition[] = [
  { action: "read", resource: "reservation", description: "View reservations." },
  { action: "create", resource: "reservation", description: "Reserve a unit." },
  { action: "update", resource: "reservation", description: "Edit/cancel reservations." },
  { action: "read", resource: "contract", description: "View contracts." },
  { action: "create", resource: "contract", description: "Create contracts." },
  { action: "update", resource: "contract", description: "Edit contracts." },
  { action: "sign", resource: "contract", description: "Mark a contract as signed." },
  { action: "read", resource: "payment_plan", description: "View payment plans and installment schedules." },
  { action: "create", resource: "payment_plan", description: "Create a payment plan." },
  { action: "read", resource: "commission", description: "View commissions." },
  { action: "update", resource: "commission", description: "Approve/mark commissions paid." },
];
