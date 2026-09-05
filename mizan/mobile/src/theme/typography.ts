import { Platform } from "react-native";

/**
 * Mizan Identity type system (`Mizan Identity.dc.html`):
 *   Spectral    — display: page & case titles. Never UI controls or data,
 *                 never below 16px, never in tables.
 *   Public Sans — interface: tables, forms, labels, filters, notifications,
 *                 the assistant's replies. Weights 400 / 500 / 600.
 *   Amiri       — the wordmark and Arabic display headings.
 *   IBM Plex Sans Arabic — neutral Arabic UI font for tables and lists.
 *
 * Font family names as loaded by `useFonts` in app/_layout.tsx.
 */
export const fontFamily = {
  // Public Sans — the interface face. Public Sans tops out at 600 in this
  // system; `bold`/`extrabold` alias to SemiBold so old call-sites keep working.
  regular: "PublicSans_400Regular",
  medium: "PublicSans_500Medium",
  semibold: "PublicSans_600SemiBold",
  bold: "PublicSans_600SemiBold",
  extrabold: "PublicSans_600SemiBold",

  // Spectral — display / serif. For page & case titles only.
  displayLight: "Spectral_300Light",
  display: "Spectral_400Regular",
  displayMedium: "Spectral_500Medium",
  displayItalic: "Spectral_400Regular_Italic",

  // Amiri — the wordmark + Arabic display.
  wordmark: "Amiri_400Regular",
  wordmarkBold: "Amiri_700Bold",

  // IBM Plex Sans Arabic — Arabic interface text (see `arabicUi()` helper).
  arabic: "IBMPlexSansArabic_400Regular",
  arabicMedium: "IBMPlexSansArabic_500Medium",
  arabicSemibold: "IBMPlexSansArabic_600SemiBold",

  /** The design's monospace accents (matter references, timers, currency
   *  codes). */
  mono: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
} as const;

export type FontWeight = keyof typeof fontFamily;

/** Named type sizes. Spectral must never render below `md` (13) in practice —
 *  use it only at `xl`+ for titles. */
export const fontSize = {
  xs: 10.5,
  sm: 11,
  smMd: 11.5,
  base: 12,
  baseMd: 12.5,
  md: 13,
  mdLg: 13.5,
  lg: 14,
  lgMd: 14.5,
  xl: 15,
  xxl: 17,
  display: 19,
  displayMd: 20,
  displayLg: 22,
  hero: 30,
  heroLg: 32,
  heroXl: 34,
  timer: 44,
} as const;

/** The uppercase micro-label: 12px / 0.2em tracking / Slate. */
export const label = {
  fontFamily: fontFamily.semibold,
  fontSize: fontSize.base,
  letterSpacing: 1.6,
  textTransform: "uppercase" as const,
};
