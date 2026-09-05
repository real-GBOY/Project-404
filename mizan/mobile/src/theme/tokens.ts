/**
 * Design tokens for Mizan Mobile — values lifted directly from the Claude
 * Design source file (`Mizan Mobile App.dc.html`), not the web app's
 * Navy/Brass tokens. `docs/system-architecture.md` explicitly allows web and
 * mobile to run different UI systems sharing only types/contracts, and this
 * design file is the stated source of truth for how mobile looks — same
 * brand family (Mizan name, "M" mark), its own warm brown/bronze token set.
 */

export const colors = {
  // Backgrounds
  bg: "#F7F3EF", // screen background (cream)
  bgSunk: "#F5F0EA", // search bars / recessed fields
  surface: "#FFFFFF", // cards
  surfaceMuted: "#FBF8F4",

  // Brand — dark brown / bronze
  brandDarkest: "#2E1A12",
  brandDark: "#3B2418", // headers, primary buttons, sign-in background
  brandDeep: "#4A2D1F", // secondary dark surfaces (inputs on dark, badges)
  brandBorderDark: "#5B3928", // borders on dark inputs, dark hairlines
  brandBronze: "#A67C52", // CTA accent on dark, icon accent
  brandBronzeText: "#24140E", // text on bronze buttons
  brandTan: "#D1BBA8", // secondary text on dark backgrounds
  brandCream: "#F1E8D9", // avatar / icon chip backgrounds
  brandCreamBorder: "#D4B98F", // matter-reference badge border, amber banner border
  brandAmberBannerBg: "#F1E8D9",
  brandAmberBannerText: "#2E1A12",
  brandAmberBannerSubtext: "#5B3928",
  brandBronzeLabel: "#8A5F32", // uppercase bronze labels (flow tags, ref text)

  // Text
  textPrimary: "#16161D",
  textSecondary: "#6B5D53",
  textMuted: "#7A6E64",
  textOnDark: "#F7F3EF",
  textOnDarkMuted: "#D1BBA8",
  chatText: "#2A2A38",
  chatTextAlt: "#33333F",
  financeSecondary: "#55556B",

  // Borders / dividers
  border: "#E8DFD6",
  borderHairline: "#F2EBE4",
  borderSectionRule: "#E3D9CF",
  borderNeutral: "#D6C8BB",
  chevronMuted: "#C7BAAE",
  chipInactiveBg: "#EFE7DE",
  chipInactiveText: "#5B3928",
  iconMuted: "#B6A797",
  placeholderIcon: "#A0938A",

  // Status — danger / overdue
  dangerBg: "#FBEBE7",
  dangerText: "#A33D2A",
  dangerAccent: "#C0503C",

  // Status — warning / amber
  warningBg: "#FAF0DF",
  warningText: "#8A6420",
  warningAccent: "#C08A3C",

  // Status — success
  successBg: "#E7F7EF",
  successText: "#067647",

  // Status — info (active)
  infoBg: "#EAF0FA",
  infoText: "#28517F",

  // Status — neutral tan (hearing set, procedural, etc.)
  neutralTanBg: "#F1E8D9",
  neutralTanText: "#4A2D1F",

  white: "#FFFFFF",
  black: "#000000",
} as const;

export const radii = {
  xs: 7,
  sm: 8,
  smMd: 10,
  md: 12,
  mdLg: 13,
  lg: 14,
  lgXl: 16,
  xl: 18,
  xxl: 20,
  sheet: 26,
  pill: 999,
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
  /** Design frame width the mock was authored against — layouts use flex/%
   *  so this is a reference, not a hard breakpoint. */
  referenceWidth: 402,
};
