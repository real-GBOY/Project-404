import type { RoleSeed } from "./rbac.js";
import { permKey } from "./rbac.js";
import { REALESTATE_PERMISSIONS } from "@atlas/realestate/permissions.js";

/**
 * Global roles the Atlas app seeds into Core RBAC (roles are global, only
 * `user_roles` assignments are tenant-scoped). Editable afterward through
 * Core `/api/rbac`. Domain code never branches on a role key, only on
 * permissions. Names/meta mirror the frontend's `roles.ts` fixture
 * ("Roles & Permissions" screen) exactly.
 */

const all = REALESTATE_PERMISSIONS.map(permKey);
const reads = REALESTATE_PERMISSIONS.filter((p) => p.action === "read").map(permKey);
const has = (...keys: string[]): string[] => {
  const known = new Set(all);
  for (const k of keys) {
    if (!known.has(k)) throw new Error(`roles.ts references unknown realestate permission "${k}"`);
  }
  return keys;
};

/** Core permissions an organization administrator needs for the Settings screen. */
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

/**
 * Core messaging permissions (core/messaging) — Core's, so not in
 * REALESTATE_PERMISSIONS and not checked by `has()`. Membership in a conversation
 * is what actually opens it; these are the coarse "may use messaging" gates.
 */
const MESSAGING_KEYS = [
  "read:conversation",
  "create:conversation",
  "send:message",
  // Attaching a file to a message uploads it through Core files (`POST /api/files/uploads`,
  // gated on upload:file). Without this only administrators could attach anything.
  "upload:file",
];
const MESSAGING_MODERATION = "moderate:message";

export const REALESTATE_ROLES: RoleSeed[] = [
  {
    key: "administrator",
    name: "Administrator",
    description: "Full access across every module, including organization settings and RBAC.",
    permissionKeys: [...all, ...CORE_ADMIN_KEYS, ...MESSAGING_KEYS, MESSAGING_MODERATION],
    meta: { dataScope: "Organisation-wide", discountAuthority: "—", canApprove: "All approvals" },
  },
  {
    key: "commercial_director",
    name: "Commercial Director",
    description: "Full sales/finance/operations access; cannot change organization settings or manage roles.",
    permissionKeys: [
      ...all.filter((k) => k !== "update:org_setting"),
      "read:role",
      "read:organization",
      ...MESSAGING_KEYS,
      MESSAGING_MODERATION,
    ],
    meta: {
      dataScope: "Organisation-wide",
      discountAuthority: "10.0%",
      canApprove: "Contracts, pricing, payouts",
    },
  },
  {
    key: "sales_manager",
    name: "Sales Manager",
    description: "Runs a sales team end to end; cannot approve finance-only approvals or edit settings.",
    permissionKeys: [
      ...has(
      "read:lead",
      "create:lead",
      "update:lead",
      "analyze:lead",
      "read:customer",
      "create:customer",
      "update:customer",
      "read:activity",
      "create:activity",
      "read:followup",
      "create:followup",
      "update:followup",
      "read:reservation",
      "create:reservation",
      "update:reservation",
      "read:contract",
      "create:contract",
      "update:contract",
      "sign:contract",
      "read:payment_plan",
      "create:payment_plan",
      "read:commission",
      "read:project",
      "read:building",
      "read:unit",
      "update:unit",
      "read:price_list",
      "read:task",
      "create:task",
      "update:task",
      "read:workflow",
      "create:workflow",
      "read:approval",
      "create:approval",
      "read:document",
      "upload:document",
      "read:dashboard",
      "read:ai_conversation",
      "ask:ai_conversation",
      "read:ai_insight",
      "dismiss:ai_insight",
      ),
      "read:conversation_insight",
      "apply:conversation_insight",
      ...MESSAGING_KEYS,
      MESSAGING_MODERATION,
    ],
    meta: { dataScope: "Own team", discountAuthority: "6.0%", canApprove: "Reservations, contracts" },
  },
  {
    key: "sales_agent",
    name: "Senior Sales Agent",
    description: "Works their own leads, customers and reservations; no approval authority.",
    permissionKeys: [
      ...has(
      "read:lead",
      "create:lead",
      "update:lead",
      "analyze:lead",
      "read:customer",
      "create:customer",
      "update:customer",
      "read:activity",
      "create:activity",
      "read:followup",
      "create:followup",
      "update:followup",
      "read:reservation",
      "create:reservation",
      "read:contract",
      "read:payment_plan",
      "read:project",
      "read:building",
      "read:unit",
      "read:price_list",
      "read:task",
      "update:task",
      "read:document",
      "upload:document",
      "read:dashboard",
      "read:ai_conversation",
      "ask:ai_conversation",
      "read:ai_insight",
      ),
      "read:conversation_insight",
      "apply:conversation_insight",
      ...MESSAGING_KEYS,
    ],
    meta: { dataScope: "Own leads & units", discountAuthority: "2.0%", canApprove: "—" },
  },
  {
    key: "finance_controller",
    name: "Finance Controller",
    description: "Owns payments, payment plans and commissions; can approve finance-related approvals.",
    permissionKeys: [
      ...has(
      "read:payment",
      "record:payment",
      "read:financial_report",
      "create:financial_report",
      "read:payment_plan",
      "create:payment_plan",
      "read:commission",
      "update:commission",
      "read:contract",
      "read:customer",
      "read:unit",
      "read:approval",
      "create:approval",
      "approve:approval",
      "read:task",
      "create:task",
      "read:document",
      "upload:document",
      "read:dashboard",
      "read:ai_conversation",
      "ask:ai_conversation",
      "read:ai_insight",
      ),
      ...MESSAGING_KEYS,
    ],
    meta: { dataScope: "Finance modules", discountAuthority: "—", canApprove: "Payments, plans, payouts" },
  },
  {
    key: "read_only",
    name: "Read-only Auditor",
    description: "Organisation-wide read access; cannot create, edit or approve anything.",
    permissionKeys: [...reads, "read:role", "read:organization", "read:audit_log", "read:conversation"],
    meta: { dataScope: "Organisation-wide", discountAuthority: "—", canApprove: "—" },
  },
];
