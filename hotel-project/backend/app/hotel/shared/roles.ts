import type { RoleSeed } from "./rbac.js";
import { permKey } from "./rbac.js";
import { HOTEL_PERMISSIONS } from "@hotel/hotel/permissions.js";

/**
 * Global roles HotelOS seeds into Core RBAC (roles are global; only `user_roles` assignments are
 * tenant-scoped). Editable afterwards on the Roles & Permissions screen (except `owner`). Domain
 * code never branches on a role key — only on permissions; the backend PermissionGuard is the
 * security boundary.
 */

const all = HOTEL_PERMISSIONS.map(permKey);
const known = new Set(all);
function has(...keys: string[]): string[] {
  for (const k of keys) {
    if (!known.has(k)) throw new Error(`roles.ts references unknown hotel permission "${k}"`);
  }
  return keys;
}

/** Core permissions (core/rbac, core/audit, core/files, core/organizations) granted per role. */
const CORE_OWNER_KEYS = [
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
const CORE_MANAGER_KEYS = ["read:role", "read:audit_log", "upload:file", "read:file"];
const CORE_FILE_KEYS = ["upload:file", "read:file"];

export const OWNER_ROLE_KEY = "owner";

export const HOTEL_ROLES: RoleSeed[] = [
  {
    key: OWNER_ROLE_KEY,
    name: "Owner",
    description: "Full business visibility and control, including settings and permissions.",
    permissionKeys: [...all, ...CORE_OWNER_KEYS],
  },
  {
    key: "manager",
    name: "Manager",
    description: "Runs daily operations, analytics and staff.",
    permissionKeys: [...all.filter((k) => k !== "update:hotel_settings"), ...CORE_MANAGER_KEYS],
  },
  {
    key: "receptionist",
    name: "Receptionist",
    description: "Reservations, guests, check-in, check-out and payment collection.",
    permissionKeys: [
      ...has(
        "read:hotel_settings",
        "read:room",
        "read:guest",
        "create:guest",
        "update:guest",
        "read:rate",
        "read:reservation",
        "create:reservation",
        "update:reservation",
        "check_in:reservation",
        "check_out:reservation",
        "read:folio",
        "post:charge",
        "create:payment",
        "read:invoice",
        "read:housekeeping",
        "read:maintenance",
        "create:maintenance",
        "read:dashboard",
      ),
      ...CORE_FILE_KEYS,
    ],
  },
  {
    key: "accountant",
    name: "Accountant",
    description: "Invoices, payments, refunds and financial reports.",
    permissionKeys: has(
      "read:hotel_settings",
      "read:room",
      "read:guest",
      "read:rate",
      "read:reservation",
      "read:folio",
      "void:charge",
      "create:payment",
      "read:invoice",
      "read:dashboard",
    ),
  },
  {
    key: "housekeeping",
    name: "Housekeeping",
    description: "Room cleaning and inspection workflows.",
    permissionKeys: has(
      "read:hotel_settings",
      "read:room",
      "read:reservation",
      "read:housekeeping",
      "update:housekeeping",
      "read:maintenance",
      "create:maintenance",
    ),
  },
  {
    key: "maintenance",
    name: "Maintenance",
    description: "Maintenance tickets and room issues.",
    permissionKeys: [
      ...has(
        "read:hotel_settings",
        "read:room",
        "read:reservation",
        "read:maintenance",
        "create:maintenance",
        "update:maintenance",
      ),
      ...CORE_FILE_KEYS,
    ],
  },
];

export const HOTEL_ROLE_KEYS: readonly string[] = HOTEL_ROLES.map((r) => r.key);
