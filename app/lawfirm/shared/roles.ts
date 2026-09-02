import type { RoleSeed } from "./rbac.js";
import { permKey } from "./rbac.js";
import { LAWFIRM_PERMISSIONS } from "../permissions.js";

/**
 * Global roles the client app seeds into Core RBAC (docs/tenancy.md: roles are
 * global, only `user_roles` assignments are tenant-scoped). These are a starting
 * set — firm admins edit them through Core `/api/rbac`. Domain code never
 * branches on a role key; it checks permissions.
 */

const all = LAWFIRM_PERMISSIONS.map(permKey);
const reads = LAWFIRM_PERMISSIONS.filter((p) => p.action === "read").map(permKey);
const has = (...keys: string[]): string[] => {
  const known = new Set(all);
  for (const k of keys) {
    if (!known.has(k)) throw new Error(`roles.ts references unknown lawfirm permission "${k}"`);
  }
  return keys;
};

/** Core permissions a firm administrator needs for the Settings screen. */
const CORE_ADMIN_KEYS = [
  "read:role",
  "manage:role",
  "assign:role",
  "read:organization",
  "update:organization",
  "manage_members:organization",
  "read:audit_log",
  "upload:file",
  "read:file",
  "delete:file",
];

export const LAWFIRM_ROLES: RoleSeed[] = [
  {
    key: "firm_admin",
    name: "Firm Administrator",
    description: "Full access to the firm's matters, finance, team and settings.",
    permissionKeys: [...all, ...CORE_ADMIN_KEYS],
  },
  {
    key: "partner",
    name: "Partner",
    description: "Full case and finance access; cannot change firm settings or manage staff profiles.",
    permissionKeys: [
      ...all.filter((k) => k !== "manage:staff" && k !== "manage:lawfirm_setting"),
      "read:role",
      "read:organization",
      "read:audit_log",
    ],
  },
  {
    key: "lawyer",
    name: "Lawyer",
    description: "Works matters end to end; cannot close matters or manage invoicing.",
    permissionKeys: has(
      "read:client",
      "create:client",
      "update:client",
      "read:matter",
      "create:matter",
      "update:matter",
      "assign:matter",
      "read:matter_note",
      "write:matter_note",
      "read:hearing",
      "schedule:hearing",
      "update:hearing",
      "read:task",
      "create:task",
      "update:task",
      "assign:task",
      "complete:task",
      "read:document",
      "upload:document",
      "update:document",
      "read:invoice",
      "read:payment",
      "read:expense",
      "record:expense",
      "read:staff",
      "read:dashboard",
      "read:lawfirm_setting",
    ),
  },
  {
    key: "paralegal",
    name: "Paralegal",
    description: "Supports matters: hearings, tasks, documents and disbursements.",
    permissionKeys: has(
      "read:client",
      "read:matter",
      "read:matter_note",
      "read:hearing",
      "schedule:hearing",
      "update:hearing",
      "read:task",
      "create:task",
      "update:task",
      "complete:task",
      "read:document",
      "upload:document",
      "update:document",
      "read:invoice",
      "read:payment",
      "read:expense",
      "record:expense",
      "read:dashboard",
      "read:lawfirm_setting",
    ),
  },
  {
    key: "finance",
    name: "Finance",
    description: "Owns billing: invoices, payments and expense approval.",
    permissionKeys: [
      ...has(
        "read:client",
        "read:matter",
        "read:hearing",
        "read:task",
        "read:document",
        "read:invoice",
        "create:invoice",
        "issue:invoice",
        "send:invoice",
        "void:invoice",
        "read:payment",
        "record:payment",
        "read:expense",
        "record:expense",
        "approve:expense",
        "read:staff",
        "read:dashboard",
        "read:lawfirm_setting",
      ),
      "read:audit_log",
    ],
  },
  {
    key: "read_only",
    name: "Read Only",
    description: "Can view everything, change nothing. For auditors and observers.",
    permissionKeys: [...reads, "read:organization"],
  },
];
