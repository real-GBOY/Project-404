/**
 * Atlas RE OS — single source of truth for every color used in the app.
 *
 * This is the ONLY file that should contain a color literal. Everything else —
 * Tailwind utility classes (`bg-primary`, `text-success`, …), mock fixtures that
 * carry a raw color (KPI deltas, badge tags, chart series, pipeline stages, unit
 * status cells, toasts), and any inline `style={{ color: … }}` — must import from
 * here instead of writing a new hex literal.
 *
 * `TOKEN_COLORS` mirrors `src/styles/tokens.css`'s `@theme` block key-for-key (same
 * grouping, same names in camelCase) and is that file's actual source of truth —
 * `colors.sync.test.ts` asserts the two never drift apart. Tailwind v4's CSS-first
 * `@theme` can't import a `.ts` module directly, so tokens.css keeps its own copy of
 * these values for Tailwind to read at build time; this file is what you edit, and
 * the test is what keeps tokens.css honest.
 *
 * `DATAVIZ_COLORS` covers colors that only ever appear as raw hex passed to fixture
 * data or inline styles (chart series, pipeline-stage/funnel gradients, one-off
 * activity/toast accents) — extracted verbatim from the design prototype, so kept
 * distinct from the semantic tone system in `TOKEN_COLORS` rather than forced onto it.
 */

export const TOKEN_COLORS = {
  surface: {
    canvas: "#f6f6f4",
    sidebar: "#f3f3f0",
    surface: "#ffffff",
    surfaceSubtle: "#fafaf8",
    surfaceSubtle2: "#f4f4f0",
    surfaceHover: "#fafafc",
    surfaceTrack: "#f2f2ee",
    surfaceNavHover: "#e9e9e4",
    /** unread notification row tint */
    surfaceUnread: "#fafbfe",
  },
  text: {
    foreground: "#0b0b0c",
    sidebarForeground: "#2a2a28",
    body: "#4a4a46",
    secondary: "#6e6e6a",
    muted: "#8a8a85",
    subtle: "#9a9a94",
    faint: "#cfcfc9",
    fainter: "#e3e3df",
    placeholder: "#a8a8a2",
    /** dashed empty-state icon glyphs */
    iconMuted: "#b5b5ae",
  },
  border: {
    border: "#e3e3df",
    borderRow: "#f4f4f0",
    borderElevated: "#d8d8d2",
  },
  brand: {
    primary: "#1b4db8",
    primaryHover: "#16409c",
    primaryDeep: "#12357f",
    primaryForeground: "#ffffff",
    primarySurface: "#edf1fc",
    primarySurfacePale: "#f4f6fc",
    primaryBorder: "#d8deee",
  },
  success: {
    success: "#1e7a5a",
    successSurface: "#e8f4ef",
    successStrong: "#3dbe8b",
    successBorder: "#bfe0d2",
  },
  danger: {
    danger: "#9a3838",
    dangerSurface: "#fbeded",
    dangerSecondary: "#c05555",
    dangerBorder: "#e8cfcf",
    dangerSolid: "#b4553a",
  },
  warning: {
    warning: "#8a6120",
    warningSurface: "#fcf3e4",
    warningSolid: "#e2b457",
    warningFill: "#f6e3bd",
    warningStrong: "#7a5416",
  },
  neutral: {
    neutralTone: "#6e6459",
    neutralToneSurface: "#f1efec",
  },
  info: {
    info: "#3a5fa8",
    infoSurface: "#f4f6fc",
  },
  chart: {
    chartPrimary: "#1b4db8",
    chartSecondary: "#9fb4e4",
    chartGrid: "#e3e3df",
    sparkPositive: "#c9d4ee",
    sparkNegative: "#ebc9c9",
    sparkNeutral: "#d8dcd4",
  },
  unit: {
    unitSold: "#1b4db8",
    unitSoldBorder: "#12357f",
    unitAvailableFill: "#e8f4ef",
    unitAvailableBorder: "#bfe0d2",
    unitAvailableFg: "#1e7a5a",
    unitReservedFill: "#f6e3bd",
    unitReservedBorder: "#e2b457",
    unitReservedFg: "#7a5416",
    unitHoldFill: "#efede8",
    unitHoldBorder: "#d8d4cb",
    unitHoldFg: "#6e6459",
    unitUnavailableFill: "#f2f2ee",
    unitUnavailableBorder: "#d8d4cb",
    unitUnavailableFg: "#b5b5ae",
  },
  overlay: {
    /** dark toast card border — a hair lighter than `text.foreground` for definition on `bg-foreground` */
    toastBorder: "#26262a",
  },
} as const;

/**
 * Colors that only ever show up as raw hex in fixture data or inline styles
 * (never as a Tailwind class) — chart series, pipeline/funnel stage gradients,
 * one-off activity/toast accents. Verbatim from the design prototype.
 */
export const DATAVIZ_COLORS = {
  pipelineStage: {
    new: "#9fb4e4",
    qualified: "#7e9bdc",
    contacted: "#5c80cf",
    viewing: "#e2b457",
    negotiation: "#d89a3c",
    reserved: "#1b4db8",
    contracted: "#2e7d5b",
    sold: "#1e7a5a",
    lost: "#c05555",
  },
  /** CRM funnel (dashboard) uses its own blue progression, distinct from `pipelineStage` */
  funnel: {
    new: "#9fb4e4",
    qualified: "#7e9bdc",
    viewing: "#5c80cf",
    negotiation: "#3a65c3",
    reserved: "#1b4db8",
    contracted: "#12357f",
  },
  /** dashboard "Reserved units" KPI sparkline accent */
  sparkReserved: "#eedcbe",
  /** dashboard inventory "On hold" segment */
  onHold: "#b9b2a6",
  /** live activity feed / toast "reservation" accent */
  activityAmber: "#f0b429",
} as const;

/**
 * The 7 recurring (surface, foreground) badge/tag pairs used throughout the status-tone
 * system (see `mocks/fixtures/tones.ts`'s `TONES` table and the dashboard/insights-feed
 * tag chips) — named once here so fixture files reference a pair instead of repeating
 * two hex literals every time the same combination recurs.
 */
export const TONE_PAIRS = {
  success: [TOKEN_COLORS.success.successSurface, TOKEN_COLORS.success.success],
  brand: [TOKEN_COLORS.brand.primarySurface, TOKEN_COLORS.brand.primary],
  warning: [TOKEN_COLORS.warning.warningSurface, TOKEN_COLORS.warning.warning],
  neutral: [TOKEN_COLORS.neutral.neutralToneSurface, TOKEN_COLORS.neutral.neutralTone],
  muted: [TOKEN_COLORS.surface.surfaceTrack, TOKEN_COLORS.text.muted],
  danger: [TOKEN_COLORS.danger.dangerSurface, TOKEN_COLORS.danger.danger],
  info: [TOKEN_COLORS.info.infoSurface, TOKEN_COLORS.info.info],
} as const satisfies Record<string, readonly [string, string]>;

/** Flat `{ name: hex }` map of every token color, for lookups keyed by camelCase name. */
export const colors: Record<string, string> = Object.fromEntries(
  Object.values(TOKEN_COLORS).flatMap((group) => Object.entries(group)),
);
