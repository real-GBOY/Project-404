/** FLUX design tokens — mirrors the FLUX / DARK objects in the design's flux-ui.jsx + screen-auth.jsx. */
export const colors = {
  lime: "#C8FF00",
  limeDim: "#A6D400",
  limeDeep: "#7FA300",
  limeTint: "#F8FFE8",
  limeTintStrong: "#F4F8E2",
  limeBorder: "rgba(200,255,0,0.55)",
  limeBar: "#E2F2A6",
  bg: "#F5F5F5",
  card: "#FFFFFF",
  ink: "#1A1A1A",
  sub: "#888888",
  hair: "#ECECEC",
  chip: "#F2F2F2",
  chipIcon: "#6E6E6E",
  track: "#E4E4E4",
  outline: "#DCDCDC",
  radio: "#D2D2D2",
  dayIdle: "#9A9A9A",
  chevron: "#BBBBBB",
  segment: "#F0F0F0",
  stepBtn: "#F0F0F0",
  lastTime: "#EDEDED",
  dashed: "#D6D6D6",
  switchOff: "#D8D8D8",
  danger: "#FF4444",
  plateau: "#E8645A",
  plateauBg: "#FFF0F0",
  plateauTitle: "#C5453B",
  plateauBody: "#B07A76",
  muted: "#AAAAAA",
  chartGrid: "#EEEEEE",
  chartLabel: "#B5B5B5",
  tabIdle: "rgba(255,255,255,0.5)",

  // ── neutrals & overlays (every literal colour in the app lives in this file) ──
  white: "#FFFFFF",
  black: "#000000",
  shadowInk: "#141414",
  darkAvatar: "#1C1C1C",
  navRing: "#171719",
  navGlass: "rgba(18,18,20,0.72)",
  whiteA06: "rgba(255,255,255,0.06)",
  whiteA10: "rgba(255,255,255,0.1)",
  whiteA12: "rgba(255,255,255,0.12)",
  whiteA14: "rgba(255,255,255,0.14)",
  whiteA20: "rgba(255,255,255,0.2)",
  whiteA35: "rgba(255,255,255,0.35)",
  whiteA45: "rgba(255,255,255,0.45)",
  whiteA50: "rgba(255,255,255,0.5)",
  whiteA55: "rgba(255,255,255,0.55)",
  whiteA60: "rgba(255,255,255,0.6)",
  whiteA62: "rgba(255,255,255,0.62)",
  blackA40: "rgba(0,0,0,0.4)",
  blackA70: "rgba(0,0,0,0.7)",
  limeA10: "rgba(200,255,0,0.1)",
  limeA12: "rgba(200,255,0,0.12)",
  limeA14: "rgba(200,255,0,0.14)",
  limeA18: "rgba(200,255,0,0.18)",
  limeA30: "rgba(200,255,0,0.3)",
  dangerBg: "rgba(255,68,68,0.08)",
  errorOnDark: "#FF6B6B",
  soft: "#F3F3F3",
  trackLight: "#EFEFEF",
  divider: "#DDDDDD",
  dot: "#CCCCCC",
  handle: "#C8C8C8",
  mutedIcon: "#999999",
  idleIcon: "#8A8A8A",
  // ── warnings / set types ──
  warn: "#D9A528",
  warnBg: "#FFF8E8",
  warnTitle: "#8A6A1E",
  warnBody: "#9A8255",
  away: "#B07A22",
  awayBg: "#FFF4E0",
  drop: "#B5701E",
  dropBg: "#FFF1E0",
} as const;

/** Lime at an arbitrary opacity (heatmap cells). */
export const limeAlpha = (o: number) => `rgba(200,255,0,${o})`;

/** Dark auth / intro surfaces. */
export const dark = {
  bg: "#0A0A0A",
  card: "#161618",
  field: "#17171A",
  fieldBorder: "rgba(255,255,255,0.07)",
  line: "rgba(255,255,255,0.08)",
  sub: "#888888",
  sheet: "#111111",
} as const;

export const radii = { xs: 7, sm: 9, md: 11, chip: 12, lg: 14, card: 16, pill: 99 } as const;

/** Spacing scale (px). Screens use a 20 gutter and 12 / 14 / 18 vertical rhythm. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;

/** Control heights shared by buttons, fields and tab bars. */
export const sizes = { control: 54, button: 56, iconButton: 42, chip: 30, tab: 36 } as const;

/** Letter-spacing in px from the design's `em` values. */
export const em = (size: number, value: number) => size * value;
