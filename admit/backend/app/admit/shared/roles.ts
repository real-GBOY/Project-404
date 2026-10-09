import type { RoleSeed } from "./rbac.js";
import { permKey } from "./rbac.js";
import { ADMIT_PERMISSIONS } from "@admit/admit/permissions.js";

/**
 * Global roles Admit seeds into Core RBAC (roles are global; only `user_roles` assignments are
 * tenant-scoped). Domain code never branches on a role key - only on permissions; the backend
 * guards are the security boundary. Event-level reach (which events a person works) is the separate
 * `admit_event_staff` assignment, unless the role holds `read_all:event`.
 */

const all = ADMIT_PERMISSIONS.map(permKey);
const known = new Set(all);
function has(...keys: string[]): string[] {
  for (const k of keys) {
    if (!known.has(k)) throw new Error(`roles.ts references unknown admit permission "${k}"`);
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
const CORE_REVIEWER_KEYS = ["read:audit_log", "read:file"];
const CORE_FILE_READ = ["read:file"];

export const OWNER_ROLE_KEY = "owner";

export const ADMIT_ROLES: RoleSeed[] = [
  {
    key: OWNER_ROLE_KEY,
    name: "Organizer owner",
    description: "Full control of the organizer: events, payments, staff and settings.",
    permissionKeys: [...all, ...CORE_OWNER_KEYS],
  },
  {
    key: "event_manager",
    name: "Event manager",
    description: "Creates and runs events, ticket types and reports. Cannot decide payments.",
    permissionKeys: [
      ...has(
        "read:event",
        "read_all:event",
        "create:event",
        "update:event",
        "publish:event",
        "manage:ticket_type",
        "manage:payment_method",
        "read:booking",
        "cancel:booking",
        "read:ticket",
        "read:checkin",
        "read:report",
        "read:email",
        "retry:email",
        "manage:event_staff",
        "read:admit_settings",
      ),
      ...CORE_FILE_READ,
    ],
  },
  {
    key: "finance_reviewer",
    name: "Payment reviewer",
    description: "Reviews payment proofs and approves or rejects them.",
    permissionKeys: [
      ...has("read:event", "read:booking", "read:payment", "approve:payment", "reject:payment", "read:ticket", "read:email", "retry:email", "read:report"),
      ...CORE_REVIEWER_KEYS,
    ],
  },
  {
    key: "door_staff",
    name: "Door staff",
    description: "Scans tickets at the gates of the events they are assigned to.",
    permissionKeys: has("read:event", "scan:checkin"),
  },
  {
    key: "viewer",
    name: "Viewer",
    description: "Read-only view of events, bookings and reports.",
    permissionKeys: has("read:event", "read_all:event", "read:booking", "read:ticket", "read:checkin", "read:report"),
  },
];
