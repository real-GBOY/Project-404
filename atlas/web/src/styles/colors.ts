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
 * activity/toast accents) — kept distinct from the semantic tone system in
 * `TOKEN_COLORS` rather than forced onto it.
 *
 * Palette is the "Atlas RE OS Identity" brand system (Claude Design:
 * `Atlas RE OS Identity.dc.html`): graphite ink on warm paper, a single ochre
 * signal color, and compute cyan reserved for AI/forecast/derived output so
 * machine-generated content is always visually distinguishable from recorded
 * fact. Shape is right-angled throughout — see `--radius-*` in tokens.css,
 * which is flat everywhere except the 2px status-chip exception.
 */

export const TOKEN_COLORS = {
  surface: {
    canvas: "#efede8",
    sidebar: "#0d1013",
    /** search field / footer row inside the dark sidebar — a shade above sidebar bg */
    surfaceSidebarSubtle: "#14181d",
    surface: "#ffffff",
    surfaceSubtle: "#f7f6f3",
    surfaceSubtle2: "#f2f1ec",
    surfaceHover: "#faf9f6",
    surfaceTrack: "#efede8",
    surfaceNavHover: "#1d232a",
    /** unread notification row tint */
    surfaceUnread: "#fbf6ec",
  },
  text: {
    foreground: "#14181d",
    sidebarForeground: "#c4c9cf",
    body: "#2a323b",
    secondary: "#5c6672",
    muted: "#8a939e",
    subtle: "#9aa2ac",
    faint: "#c4c9cf",
    fainter: "#e2dfd8",
    placeholder: "#9aa2ac",
    /** dashed empty-state icon glyphs */
    iconMuted: "#c4c9cf",
  },
  border: {
    border: "#e2dfd8",
    borderRow: "#efede8",
    borderElevated: "#c4c9cf",
    /** hairlines inside the dark sidebar (search field, section dividers, footer) */
    borderSidebar: "#2a323b",
  },
  brand: {
    primary: "#e0a020",
    primaryHover: "#c98a15",
    primaryDeep: "#9c6b10",
    /** ochre fills always carry dark ink text, never white */
    primaryForeground: "#14181d",
    primarySurface: "#fcefd2",
    primarySurfacePale: "#fefaee",
    primaryBorder: "#f2dca0",
  },
  success: {
    success: "#2f6b46",
    successSurface: "#e7f0ea",
    successStrong: "#5fa87a",
    successBorder: "#c3dbc9",
  },
  danger: {
    danger: "#a8382f",
    dangerSurface: "#f8e9e7",
    dangerSecondary: "#d88078",
    dangerBorder: "#e9c6c1",
    dangerSolid: "#9a332b",
  },
  warning: {
    warning: "#8a5e14",
    warningSurface: "#f5ebd7",
    warningSolid: "#b8791a",
    warningFill: "#ead9b0",
    warningStrong: "#8a5e14",
  },
  neutral: {
    neutralTone: "#5c6672",
    neutralToneSurface: "#eaebe7",
  },
  /** repurposed as "Compute Cyan" — AI, forecasts, derived metrics; never recorded fact */
  info: {
    info: "#1f6f73",
    infoSurface: "#e3eeee",
    /** bright cyan for text on dark/graphite surfaces (AI insight panels) */
    infoStrong: "#7fc4c4",
  },
  chart: {
    chartPrimary: "#1d232a",
    chartSecondary: "#c4c9cf",
    chartGrid: "#e2dfd8",
    sparkPositive: "#d3e6d9",
    sparkNegative: "#f0d3cf",
    sparkNeutral: "#dedad1",
  },
  unit: {
    unitSold: "#2f6b46",
    unitSoldBorder: "#255939",
    unitAvailableFill: "#ffffff",
    unitAvailableBorder: "#c4c9cf",
    unitAvailableFg: "#5c6672",
    unitReservedFill: "#e0a020",
    unitReservedBorder: "#e0a020",
    unitReservedFg: "#14181d",
    unitHoldFill: "#8a939e",
    unitHoldBorder: "#5c6672",
    unitHoldFg: "#ffffff",
    unitUnavailableFill: "#efede8",
    unitUnavailableBorder: "#c4c9cf",
    unitUnavailableFg: "#9aa2ac",
  },
  overlay: {
    /** dark toast card border — a hair lighter than `surface.sidebar` for definition on `bg-foreground` */
    toastBorder: "#2a323b",
  },
} as const;

/**
 * Colors that only ever show up as raw hex in fixture data or inline styles
 * (never as a Tailwind class) — chart series, pipeline/funnel stage gradients,
 * one-off activity/toast accents.
 */
export const DATAVIZ_COLORS = {
  pipelineStage: {
    new: "#c4c9cf",
    qualified: "#aeb6bf",
    contacted: "#8a939e",
    viewing: "#ead9b0",
    negotiation: "#ddae5c",
    reserved: "#e0a020",
    contracted: "#1f6f73",
    sold: "#2f6b46",
    lost: "#a8382f",
  },
  /** CRM funnel (dashboard) uses its own graphite→ochre progression, distinct from `pipelineStage` */
  funnel: {
    new: "#c4c9cf",
    qualified: "#aeb6bf",
    viewing: "#8a939e",
    negotiation: "#ddae5c",
    reserved: "#e0a020",
    contracted: "#9c6b10",
  },
  /** dashboard "Reserved units" KPI sparkline accent */
  sparkReserved: "#f5e0ad",
  /** dashboard inventory "On hold" segment */
  onHold: "#b0afa7",
  /** live activity feed / toast "reservation" accent */
  activityAmber: "#e0a020",
} as const;

/**
 * The 7 recurring (surface, foreground) badge/tag pairs used throughout the status-tone
 * system (dashboard/insights-feed tag chips) — named once here so callers reference a pair
 * instead of repeating two hex literals every time the same combination recurs.
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
