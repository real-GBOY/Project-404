/**
 * Raqib: the single source of truth for every color in the web app.
 *
 * This is the ONLY TypeScript file that may contain a color literal (hex or rgba). Every component, presenter and
 * generated screen takes its colors from `C` below (`C.text.secondary`, `C.status.danger.fg`, …). A static test
 * (`colors.test.ts`) fails the build if a new literal appears anywhere else, and `tokens.css` (the CSS copy used by
 * `index.css`) is asserted to match this file key for key.
 *
 * Palette: the approved Raqib identity, a court-green primary on warm paper with graphite ink, plus one tone family
 * per meaning (success, warning, danger, info, review) and a dark chrome set for the sidebar and presenter bars.
 * Names say what a color is FOR; values that look alike but play different roles are kept apart on purpose.
 */

export const COLORS = {
  /** Page and card backgrounds, light to dark. */
  surface: {
    white: "#FFFFFF",
    canvas: "#F5F4F0",
    paper: "#FAF9F6",
    paperAlt: "#F6F5F1",
    subtle: "#F3F1EC",
    track: "#EFEDE7",
    sunken: "#ECEAE5",
    sunkenAlt: "#F0EEE8",
    sunkenWarm: "#ECEAE4",
    sunkenDeep: "#E8E5DE",
    hover: "#EEEEEE",
  },
  /** Lines and outlines. */
  border: {
    hairline: "#E3E1DA",
    input: "#D6D3CB",
    soft: "#D9D6CF",
    strong: "#C9C6BE",
    stronger: "#B9B6AE",
  },
  /** Type on light surfaces. */
  text: {
    ink: "#191C1F",
    body: "#3D4247",
    graphite: "#4A4F57",
    secondary: "#5C6168",
    muted: "#8B9097",
  },
  /** The court-green brand and its tints. */
  brand: {
    primary: "#0F5C4A",
    primaryDark: "#0A4537",
    /** disabled / waiting primary action */
    primaryMuted: "#9DB8B0",
    tint: "#E6F2EE",
    tintAlt: "#E2EEE9",
    wash: "#F2F7F5",
    washAlt: "#F3F7F5",
    washFaint: "#F6FAF8",
    /** light text and fills on the dark chrome */
    onDark: "#E8EEEB",
  },
  /** One family per meaning: foreground, background, and where needed a border or a stronger tone. */
  status: {
    success: { fg: "#1E6B45", bg: "#E3F0E7" },
    warning: {
      fg: "#8A5A00",
      bg: "#FAEFD8",
      /** the strongest readable amber (text on the warning background) */
      strong: "#6B4600",
      deep: "#3D2A00",
      /** marks, bars and borders in the warning family */
      mark: "#C98A12",
      /** mid score on the compliance scale */
      score: "#B07400",
      bgDeep: "#F1E2C2",
      bgFaint: "#FFFBF2",
      border: "#EBD3A0",
      borderAlt: "#E8D2A0",
      borderStrong: "#E5C98F",
    },
    danger: {
      fg: "#A3262A",
      bg: "#F7E2E1",
      bgSoft: "#F1DCDB",
      bgTint: "#FBE9E9",
      bgFaint: "#FDF8F7",
      bgWash: "#F4ECEB",
      bgRose: "#F0D6D4",
      border: "#E8C4C2",
      borderAlt: "#E6B5B6",
      borderStrong: "#D9A3A0",
      borderMuted: "#C9A9A7",
      /** danger text on the dark chrome */
      onDark: "#E2A9A6",
      bright: "#E0605A",
      deep: "#5A1416",
      deepest: "#1E1415",
      darkLine: "#6B3B3D",
    },
    info: { fg: "#1F4E8C", bg: "#E2EBF6", bgAlt: "#E8F0FA", border: "#B9CDE8", mark: "#7A9CC6" },
    review: { fg: "#5B3E91", bg: "#ECE6F5", deep: "#3A2560" },
  },
  /** The dark chrome: sidebar, presenter bar, app frame. */
  chrome: {
    bg: "#121A18",
    bgDeep: "#0B0F0E",
    bgAlt: "#18201E",
    bgRaised: "#1A2421",
    hover: "#1F2B28",
    selected: "#26332F",
    line: "#2A3431",
    lineAlt: "#2E3B37",
    frame: "#2A302E",
    textStrong: "#C9D1CE",
    text: "#B7C1BD",
    textMuted: "#9AA6A1",
    textFaint: "#7D8A85",
    textFainter: "#6F7B77",
    accent: "#3FA584",
    accentLight: "#7FD1B3",
  },
  /** Backdrops behind dialogs, sheets and viewers. */
  scrim: {
    faint: "rgba(18,26,24,.25)",
    light: "rgba(18,26,24,.35)",
    medium: "rgba(18,26,24,.4)",
    strong: "rgba(18,26,24,.45)",
    heavy: "rgba(18,26,24,.6)",
  },
  /** Drop shadows. */
  shadow: {
    hairline: "rgba(0,0,0,.08)",
    soft: "rgba(0,0,0,.12)",
    panel: "rgba(0,0,0,.15)",
    popover: "rgba(0,0,0,.25)",
    toast: "rgba(0,0,0,.28)",
    modal: "rgba(0,0,0,.3)",
    viewer: "rgba(0,0,0,.35)",
  },
  /** A translucent white used over images and sticky headers. */
  glass: "rgba(255,255,255,.85)",
} as const;

/** The short name every module imports: `import { C } from "@/styles/colors"`. */
export const C = COLORS;

type Leaf = string | { [k: string]: Leaf };

/** Flatten to `group-name: value` pairs, kebab-cased (`status.warning.borderAlt` → `status-warning-border-alt`). */
export function flattenColors(tree: Leaf = COLORS, prefix: string[] = []): Array<[string, string]> {
  return Object.entries(tree).flatMap(([k, v]) => {
    const path = [...prefix, k.replace(/([A-Z])/g, "-$1").toLowerCase()];
    return typeof v === "string"
      ? [[path.join("-"), v] as [string, string]]
      : flattenColors(v, path);
  });
}
