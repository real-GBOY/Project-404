/**
 * Sidebar navigation, grouped exactly like the HotelOS design (Overview · Operations · Guests ·
 * Finance · Insights · Administration). An item appears only once its screen exists, and only
 * for users holding its permission (UX only — the backend enforces). Groups with no visible item
 * are hidden.
 */
export interface NavItem {
  label: string;
  to: string;
  /** `action:resource` required to see the item; omitted = every signed-in user. */
  permission?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  { label: "Overview", items: [{ label: "Dashboard", to: "/" }] },
  {
    label: "Operations",
    items: [
      { label: "Reservations", to: "/reservations", permission: "read:reservation" },
      { label: "Calendar", to: "/calendar", permission: "read:reservation" },
      { label: "Front Desk", to: "/front-desk", permission: "check_in:reservation" },
      { label: "Rooms", to: "/rooms", permission: "read:room" },
      { label: "Housekeeping", to: "/housekeeping", permission: "read:housekeeping" },
      { label: "Maintenance", to: "/maintenance", permission: "read:maintenance" },
    ],
  },
  { label: "Guests", items: [{ label: "Guests", to: "/guests", permission: "read:guest" }] },
  {
    label: "Administration",
    items: [
      { label: "Staff & Permissions", to: "/staff", permission: "read:staff" },
      { label: "Rates & Discounts", to: "/rates", permission: "read:rate" },
      { label: "Settings", to: "/settings", permission: "read:hotel_settings" },
    ],
  },
];

export function visibleNav(groups: NavGroup[], can: (permission: string) => boolean): NavGroup[] {
  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.permission || can(i.permission)) }))
    .filter((g) => g.items.length > 0);
}
