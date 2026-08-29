export interface Role {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
}

/** Reserved role keys the Core seeds on every deployment. */
export const SYSTEM_ROLES = {
  /** Full access — "*:*". Assigned to the bootstrap admin. */
  admin: "admin",
} as const;
