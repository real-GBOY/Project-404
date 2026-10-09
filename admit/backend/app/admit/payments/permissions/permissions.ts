import type { PermissionDefinition } from "@admit/admit/shared/rbac.js";

export const paymentsPermissions: PermissionDefinition[] = [
  { action: "read", resource: "payment", description: "Open the payment review queue and see payment proofs." },
  { action: "approve", resource: "payment", description: "Approve a payment, which confirms the booking and issues its tickets." },
  { action: "reject", resource: "payment", description: "Reject a payment with a reason for the customer." },
];
