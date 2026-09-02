/**
 * Navigation model — the sidebar's grouping follows the design (PLAN §8), not a
 * flat list. `perm` is the key the backend issues in `/api/me`; a `null` perm
 * means "any authenticated user". Gating here is UX only — the backend enforces.
 */

export interface NavItem {
  /** absolute route path */
  to: string;
  /** i18n key under the `common:nav` namespace */
  labelKey: string;
  /** Material Symbols Rounded name */
  icon: string;
  /** `action:resource` required to see this item, or null for session-only */
  perm: string | null;
  /** also treat these path prefixes as "this item is active" */
  match?: string[];
}

export interface NavGroup {
  /** i18n key under `common:nav.groups`, or null for the ungrouped lead items */
  titleKey: string | null;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    titleKey: null,
    items: [{ to: "/", labelKey: "dashboard", icon: "dashboard", perm: "read:dashboard" }],
  },
  {
    titleKey: "workspace",
    items: [
      { to: "/clients", labelKey: "clients", icon: "groups", perm: "read:client" },
      { to: "/matters", labelKey: "matters", icon: "gavel", perm: "read:matter" },
      { to: "/calendar", labelKey: "calendar", icon: "calendar_month", perm: "read:hearing" },
      { to: "/documents", labelKey: "documents", icon: "folder_open", perm: "read:document" },
    ],
  },
  {
    titleKey: "finance",
    items: [
      { to: "/billing", labelKey: "finance", icon: "payments", perm: "read:invoice" },
    ],
  },
  {
    titleKey: "firm",
    items: [{ to: "/team", labelKey: "team", icon: "badge", perm: "read:staff" }],
  },
  {
    titleKey: "system",
    items: [
      { to: "/notifications", labelKey: "notifications", icon: "notifications", perm: null },
      {
        to: "/settings",
        labelKey: "settings",
        icon: "settings",
        perm: "read:lawfirm_setting",
        match: ["/settings"],
      },
    ],
  },
];

/** Flattened, in nav order — used by the command menu and breadcrumb resolver. */
export const NAV_ITEMS: NavItem[] = NAV.flatMap((g) => g.items);
