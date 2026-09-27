/**
 * The Hotel Nayel demo property — a four-star Nile-side hotel in Cairo (the public site is
 * hotel-project/web). Names are realistic Egyptian names; money is EGP. The dataset grows slice
 * by slice as the domain does; every row here must be reachable through a real domain service.
 */
export const DEMO_ORG = {
  name: "Hotel Nayel",
  slug: "hotel-nayel",
} as const;

export const DEMO_PASSWORD = "demo-password-2026";

export interface DemoStaffMember {
  key: string;
  name: string;
  email: string;
  /** Core RBAC role key assigned in the demo organization. */
  roleKey: string;
  membershipRole: "owner" | "member";
}

/**
 * The first entry is the organization owner and the demo login. Until the hotel roles exist the
 * owner holds Core's system `admin` role (full access), which is also the correct long-term grant
 * for an owner.
 */
export const DEMO_STAFF: DemoStaffMember[] = [
  {
    key: "owner",
    name: "Ahmed Nabil",
    email: "ahmed.nabil@hotelnayel.com",
    roleKey: "admin",
    membershipRole: "owner",
  },
];
