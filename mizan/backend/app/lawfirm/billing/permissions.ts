import type { PermissionDefinition } from "@app/lawfirm/shared/rbac.js";

/**
 * Permissions the Billing module contributes to RBAC (§3.2). Covers invoices
 * (with fee lines + disbursements), payments allocated to them, and expenses.
 */
export const billingPermissions: PermissionDefinition[] = [
  { action: "read", resource: "invoice", description: "View invoices and their line items" },
  { action: "create", resource: "invoice", description: "Draft a new invoice" },
  { action: "issue", resource: "invoice", description: "Issue a drafted invoice" },
  { action: "send", resource: "invoice", description: "Send an invoice to the client" },
  { action: "void", resource: "invoice", description: "Void an invoice" },
  { action: "read", resource: "payment", description: "View payments and receipts" },
  { action: "record", resource: "payment", description: "Record a payment against an invoice" },
  { action: "read", resource: "expense", description: "View disbursements / expenses" },
  { action: "record", resource: "expense", description: "Record a disbursement / expense" },
  { action: "approve", resource: "expense", description: "Approve a pending expense" },
];
