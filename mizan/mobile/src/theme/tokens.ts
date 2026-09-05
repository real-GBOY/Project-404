/**
 * Design tokens for Mizan Mobile — the "Mizan Identity" visual system
 * (Claude Design: `Mizan Identity.dc.html`), the same institutional identity
 * the web app runs (`mizan/web/src/styles/tokens.css`).
 *
 *   Court Navy  #16233A  primary ink · the mark · headers · primary buttons
 *   Slate Blue  #31456B  interactive states · links · secondary labels
 *   Brass       #B99A5B  accent only — never a surface, never body text
 *   Paper       #F5F3EF  default background — warm, not white
 *   Card        #FAF9F6  raised surfaces: case cards, panels, tables
 *
 *   Spectral    display — page & case titles, never UI controls or data
 *   Public Sans interface — tables, forms, labels, filters, notifications
 *   Amiri       wordmark & Arabic display  ·  IBM Plex Sans Arabic — Arabic UI
 *
 * Token NAMES are kept stable so screen code barely moves — only the values.
 */

export const colors = {
  // Surfaces — hairlines on warm paper
  bg: "#F5F3EF", // Paper
  bgSunk: "#F2EFE8", // row hover, search field
  surface: "#FAF9F6", // Card — raised surfaces
  surfaceMuted: "#F6F3EC", // nested cards

  // Brand — Court Navy ramp
  brandDarkest: "#0B1422",
  brandDark: "#16233A", // headers, primary buttons, sign-in panel
  brandDeep: "#21304A", // hover / secondary dark surfaces
  brandBorderDark: "#2C3B54", // hairlines on navy
  brandBronze: "#B99A5B", // Brass — accent only
  brandBronzeText: "#16233A", // navy text on a brass surface
  brandTan: "rgba(245,243,239,0.66)", // muted Paper — labels/subtitles on navy panels
  brandCream: "#F0EADB", // surface-sand: date chips, avatar tiles, active nav
  brandCreamBorder: "#CBB086", // matter-number chip / sand callout border
  brandAmberBannerBg: "#F0EADB",
  brandAmberBannerText: "#16233A",
  brandAmberBannerSubtext: "#5B4A2C",
  brandBronzeLabel: "#31456B", // uppercase section labels — Slate per the identity

  // Text ramp
  textPrimary: "#16233A",
  textSecondary: "#47597A",
  textMuted: "#7B869A",
  textOnDark: "#F5F3EF", // Paper on navy
  textOnDarkMuted: "rgba(245,243,239,0.62)",
  chatText: "#29344A",
  chatTextAlt: "#3D4A63",
  financeSecondary: "#6A7690",

  // Borders / dividers
  border: "#E4E0D6",
  borderHairline: "#F0EDE4",
  borderSectionRule: "#EEEAE0",
  borderNeutral: "#DAD5C8",
  chevronMuted: "#AEB6C4",
  chipInactiveBg: "#F0EADB",
  chipInactiveText: "#47597A",
  iconMuted: "#98A1B3",
  placeholderIcon: "#98A1B3",

  // Status — Overdue
  dangerBg: "#F5E7E3",
  dangerText: "#8C3B2E",
  dangerAccent: "#A8412F",

  // Status — Due soon
  warningBg: "#F2EDE0",
  warningText: "#7A6A3C",
  warningAccent: "#B99A5B",

  // Status — Filed
  successBg: "#E6EFE9",
  successText: "#2F5C47",

  // Status — Slate (info / active)
  infoBg: "#E8ECF3",
  infoText: "#31456B",

  // Status — Closed (neutral)
  neutralTanBg: "#EDEAE2",
  neutralTanText: "#575D54",

  white: "#FFFFFF",
  black: "#000000",
} as const;

/** Institutional radii — tightened, never pill-shaped for surfaces
 *  (matches `mizan/web` tokens.css). */
export const radii = {
  xs: 3, // checkbox, chip, badge
  sm: 4,
  smMd: 5, // small controls, disc icons
  md: 6, // buttons, inputs, nav items
  mdLg: 7, // logo tile, tab group
  lg: 7,
  lgXl: 8, // the card
  xl: 8,
  xxl: 8,
  sheet: 14, // bottom sheet
  pill: 999, // toggles and true pills only
} as const;

export const spacing = {
  0: 0,
  1: 2,
  2: 4,
  3: 6,
  4: 8,
  5: 9,
  6: 10,
  7: 11,
  8: 12,
  9: 13,
  10: 14,
  11: 15,
  12: 16,
  13: 18,
  14: 20,
  15: 22,
  16: 26,
  17: 30,
  18: 44,
  19: 62,
} as const;

export const screen = {
  referenceWidth: 402,
};
