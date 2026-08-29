/**
 * Organizations & Users start-here (§7.4): an organization entity,
 * user-to-organization membership, basic settings. Org hierarchy and
 * invitation flows are explicitly "Later".
 */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  settings: Record<string, unknown>;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  membershipRole: string;
  joinedAt: Date;
}

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
