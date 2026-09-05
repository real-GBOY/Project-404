import { Platform } from "react-native";

/** Font family names as loaded by `useFonts` in app/_layout.tsx (see
 *  @expo-google-fonts/plus-jakarta-sans). */
export const fontFamily = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  extrabold: "PlusJakartaSans_800ExtraBold",
  /** The design's monospace accents (matter references, timers, currency
   *  codes) use `ui-monospace, Menlo, monospace` on web — the platform
   *  system monospace is the native equivalent. */
  mono: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
} as const;

export type FontWeight = keyof typeof fontFamily;

/** Named type sizes seen across the design, so screens reference a scale
 *  instead of repeating magic numbers. */
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
