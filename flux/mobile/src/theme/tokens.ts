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
} as const;

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

export const radii = { card: 16, chip: 12, pill: 99 } as const;

/** Letter-spacing in px from the design's `em` values. */
export const em = (size: number, value: number) => size * value;
