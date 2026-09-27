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
  {
    action: "read",
    resource: "payment",
    description: "View the payments ledger, refunds and outstanding balances.",
  },
  { action: "create", resource: "refund", description: "Refund an overpayment to a guest." },
  { action: "void", resource: "invoice", description: "Void an issued invoice, with a reason." },
  {
    action: "issue",
    resource: "invoice",
    description: "Issue a new invoice after a void, once the folio is settled.",
  },
];
