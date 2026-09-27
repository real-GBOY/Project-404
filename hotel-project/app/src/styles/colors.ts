/**
 * The HotelOS palette — the ONLY place a color literal may be written in this app (Atlas rule).
 * Values are copied exactly from the HotelOS Claude Design source (`HotelOS.dc.html`, its `S`
 * token object and inline styles): warm oklch neutrals on hue 75, an indigo primary on hue 265,
 * and five status tones each with a soft background. `tokens.css` mirrors this object for
 * Tailwind's `@theme` (CSS can't import TS); `colors.sync.test.ts` keeps the two identical.
 */
export const colors = {
  // Surfaces
  canvas: "oklch(97.5% 0.006 75)",
  surface: "oklch(99% 0.003 75)",

  // Lines
  border: "oklch(89% 0.01 75)",
  borderSubtle: "oklch(93% 0.008 75)",
  divider: "oklch(95% 0.006 75)",
  rule: "oklch(85% 0.01 75)",

  // Text
  ink: "oklch(23% 0.012 75)",
  inkSoft: "oklch(35% 0.012 75)",
  inkNav: "oklch(30% 0.012 75)",
  muted: "oklch(50% 0.012 75)",
  faint: "oklch(65% 0.01 75)",

  // Brand
  primary: "oklch(48% 0.14 265)",
  primaryStrong: "oklch(40% 0.15 265)",
  primarySoft: "oklch(94% 0.035 265)",

  // Status tones (foreground + soft background)
  success: "oklch(48% 0.13 150)",
  successSoft: "oklch(94% 0.045 150)",
  warning: "oklch(55% 0.15 75)",
  warningSoft: "oklch(95% 0.06 75)",
  danger: "oklch(50% 0.18 22)",
  dangerSoft: "oklch(95% 0.045 22)",
  info: "oklch(50% 0.1 230)",
  infoSoft: "oklch(94% 0.03 230)",
  neutral: "oklch(40% 0.012 75)",
  neutralSoft: "oklch(93% 0.008 75)",

  // Charts (the muted bars behind today's highlighted bar)
  chartMuted: "oklch(90% 0.01 265)",
  chartSuccessMuted: "oklch(90% 0.03 150)",

  // Elevation tint for popovers / palette
  shadow: "oklch(20% 0.01 75 / 0.14)",
} as const satisfies Record<string, string>;

export type ColorToken = keyof typeof colors;
