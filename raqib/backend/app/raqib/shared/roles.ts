import type { RoleSeed } from "./rbac.js";
import { ROLE_KEYS, type RoleKey } from "./modules.js";

/**
 * Core RBAC roles Raqib seeds — one per Raqib role key. Roles are global per deployment (only
 * `user_roles` assignments are per-tenant), so they carry ONLY Core infrastructure permissions:
 * uploading/reading evidence files. Everything a role may do inside Raqib is decided by the
 * organization's permission template + project scope (`app/raqib/access`), which an organization
 * can edit without touching global Core roles. Domain code never branches on a role key for
 * authorization — it asks the access service.
 */
const FILE_KEYS = ["upload:file"];

const META: Record<RoleKey, { name: string; description: string; permissionKeys: string[] }> = {
  qm: { name: "Quality Management", description: "Operational control across projects, reviews, approvals and forms.", permissionKeys: [...FILE_KEYS] },
  qe: { name: "Quality Employee", description: "Reviews, returns and follows up inspections within assigned projects.", permissionKeys: FILE_KEYS },
  pm: { name: "Project Manager", description: "Results, observations and corrective actions of assigned projects.", permissionKeys: FILE_KEYS },
  ins: { name: "Quality Inspector", description: "Performs assigned visits and submits inspections.", permissionKeys: FILE_KEYS },
  gs: { name: "Security Supervisor", description: "Guard evaluations, observations and training requests in scope.", permissionKeys: FILE_KEYS },
  guard: { name: "Security Guard", description: "Own submissions: surveys, complaints and confidential reports.", permissionKeys: FILE_KEYS },
  adm: { name: "Administrative Staff", description: "Maintains and prints the visit schedule within assigned projects.", permissionKeys: [] },
  gm: { name: "General Manager", description: "Executive indicators and confidential-report grant administration.", permissionKeys: [] },
};

/** The Core role key used for a Raqib role (prefixed so it can never collide with other products). */
export const coreRoleKey = (role: RoleKey): string => `raqib_${role}`;

export const RAQIB_ROLES: RoleSeed[] = ROLE_KEYS.map((k) => ({
  key: coreRoleKey(k),
  name: META[k].name,
  description: META[k].description,
  permissionKeys: META[k].permissionKeys,
}));
