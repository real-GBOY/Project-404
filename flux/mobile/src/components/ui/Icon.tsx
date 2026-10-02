import Svg, { Circle, Path, Rect } from "react-native-svg";

type Shape =
  | { p: string }
  | { r: { x: number; y: number; w: number; h: number; rx: number } }
  | { c: { cx: number; cy: number; r: number; solid?: boolean } };

const p = (d: string): Shape => ({ p: d });
const r = (x: number, y: number, w: number, h: number, rx: number): Shape => ({
  r: { x, y, w, h, rx },
});
/** `solid` draws a filled dot with no stroke (instagram's flash dot, target's centre). */
const c = (cx: number, cy: number, rad: number, solid = false): Shape => ({
  c: { cx, cy, r: rad, solid },
});

/**
 * Every line icon used by the FLUX design: onboarding-icons.jsx (OI) plus the
 * flux-ui.jsx set. Stroke only; 24×24 viewBox unless listed in VIEWBOX.
 */
const ICONS = {
  // ── onboarding-icons.jsx ──
  muscle: [p("M5 19V12"), p("M12 19V5"), p("M19 19V9"), p("M16 6l3-1 1 3")],
  stronger: [p("M3 17l5-5 4 4 9-9"), p("M16 7h5v5")],
  healthy: [p("M12 20s-7-4.6-7-9.7A3.4 3.4 0 0 1 12 7a3.4 3.4 0 0 1 7 3.3C19 15.4 12 20 12 20Z")],
  flame: [
    p(
      "M12 3c1.2 3.6 4.6 4.8 4.6 9.1A4.6 4.6 0 0 1 7.4 12c0-1.5.6-2.7 1.4-3.5.4 1 .9 1.4 1.7 1.6C9.7 7.7 10.8 5.3 12 3Z",
    ),
  ],
  endurance: [p("M3 12h4l2.5-7 5 14 2.5-7H21")],
  sprout: [
    p("M12 21v-9"),
    p("M12 13c0-3.3 2.3-5.4 5.4-5.4 0 3.3-2.3 5.4-5.4 5.4Z"),
    p("M12 14c0-2.7-2-4.6-4.8-4.6 0 2.7 2 4.6 4.8 4.6Z"),
  ],
  bars: [p("M6 19v-5"), p("M12 19V8"), p("M18 19v-9")],
  zap: [p("M13 3 5 13h6l-1 8 8-10h-6l1-8Z")],
  upperLower: [r(4, 5, 16, 6, 2), r(4, 13, 16, 6, 2)],
  fullbody: [c(12, 12, 8), c(12, 12, 3)],
  grid: [r(4, 4, 7, 7, 1.5), r(13, 4, 7, 7, 1.5), r(4, 13, 7, 7, 1.5), r(13, 13, 7, 7, 1.5)],
  pencil: [p("M15.5 4.5 19.5 8.5 8 20H4v-4L15.5 4.5Z"), p("M14 6l4 4")],
  building: [r(5, 3, 14, 18, 2), p("M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2")],
  dumbbell: [p("M6.5 9v6M9.5 7.5v9M14.5 7.5v9M17.5 9v6M9.5 12h5")],
  barbell: [p("M3 10v4M6 8v8M18 8v8M21 10v4M6 12h12")],
  body: [c(12, 5, 2.3), p("M12 8v7M8 11l4-1 4 1M9.5 21 12 15l2.5 6")],
  clock: [c(12, 12, 8), p("M12 8v4l3 2")],
  calendar: [r(4, 5, 16, 16, 2), p("M4 9.5h16M8 3v4M16 3v4")],
  scale: [c(12, 6.5, 2.2), p("M5.5 20 8.5 11h7l3 9H5.5Z")],
  ruler: [r(3, 8, 18, 8, 2), p("M7 8v3M11 8v4M15 8v3M19 8v4")],
  person: [c(12, 8, 3.4), p("M5.5 20c0-3.4 2.9-5.4 6.5-5.4s6.5 2 6.5 5.4")],
  target: [c(12, 12, 8), c(12, 12, 4), c(12, 12, 0.6, true)],
  // ── flux-ui.jsx ──
  bell: [p("M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"), p("M13.7 21a2 2 0 0 1-3.4 0")],
  home: [p("M3 10.5 12 3l9 7.5"), p("M5 9.5V20h14V9.5")],
  history: [p("M3 12a9 9 0 1 0 3-6.7"), p("M3 4v4h4"), p("M12 8v4l3 2")],
  stats: [p("M5 20V11"), p("M12 20V5"), p("M19 20v-7")],
  profile: [c(12, 8, 3.6), p("M5 20c0-3.6 3.1-5.6 7-5.6s7 2 7 5.6")],
  layers: [p("m12 3 8 4.5-8 4.5-8-4.5L12 3Z"), p("m4 12 8 4.5L20 12")],
  trophy: [
    p("M7 4h10v4a5 5 0 0 1-10 0V4Z"),
    p("M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3"),
    p("M12 13v4M9 21h6M10 17h4"),
  ],
  arrowUp: [p("M12 19V6M6 11l6-6 6 6")],
  play: [p("M7 5v14l11-7L7 5Z")],
  back: [p("M15 5l-7 7 7 7")],
  arrowRight: [p("M5 12h14M13 6l6 6-6 6")],
  chevR: [p("M9 5l7 7-7 7")],
  plus: [p("M12 5v14M5 12h14")],
  minus: [p("M5 12h14")],
  mic: [r(9, 3, 6, 11, 3), p("M6 11a6 6 0 0 0 12 0M12 17v3")],
  mail: [r(3, 5, 18, 14, 3), p("m4 7 8 5 8-5")],
  lock: [r(4.5, 10.5, 15, 10, 3), p("M8 10.5V8a4 4 0 0 1 8 0v2.5")],
  user: [c(12, 8, 3.6), p("M5 20c0-3.6 3.1-5.6 7-5.6s7 2 7 5.6")],
  eye: [p("M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"), c(12, 12, 3)],
  dumbbellLogo: [p("M11 11v10M21 11v10M6 14v4M26 14v4M11 16h10")],
  google: [p("M21 12c0 5-3.7 8.5-9 8.5A8.5 8.5 0 1 1 17.6 5.6"), p("M21 12h-8")],
  instagram: [r(3.5, 3.5, 17, 17, 5), c(12, 12, 3.8), c(16.8, 7.2, 0.9, true)],
  facebook: [p("M14.5 8.5h2.5M14.5 8.5V7a2 2 0 0 1 2-2H17M14.5 8.5v12M14.5 12.5h-2.5")],
  filter: [p("M3 5h18M6 12h12M10 19h4")],
  gear: [
    c(12, 12, 3.2),
    p(
      "M12 2.5v2.5M12 19v2.5M21.5 12H19M5 12H2.5M18.7 5.3 17 7M7 17l-1.7 1.7M18.7 18.7 17 17M7 7 5.3 5.3",
    ),
  ],
  share: [c(6, 12, 2.4), c(18, 6, 2.4), c(18, 18, 2.4), p("m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6")],
  check: [p("M5 12.5 10 17.5 19 6.5")],
  moon: [p("M20 14.5A8 8 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z")],
  globe: [c(12, 12, 9), p("M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18")],
  logout: [p("M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10")],
} satisfies Record<string, Shape[]>;

export type IconName = keyof typeof ICONS;

const VIEWBOX: Partial<Record<IconName, number>> = { dumbbellLogo: 32 };

const STROKE_WIDTH: Partial<Record<IconName, number>> = {
  bell: 1.7,
  home: 1.9,
  history: 1.9,
  stats: 1.9,
  profile: 1.9,
  layers: 1.7,
  trophy: 1.7,
  flame: 1.7,
  arrowUp: 2.4,
  play: 2,
  back: 2,
  arrowRight: 2.2,
  chevR: 2,
  plus: 2.4,
  minus: 2.4,
  mic: 1.9,
  dumbbellLogo: 2.4,
  google: 1.9,
  instagram: 1.9,
  facebook: 1.9,
  filter: 1.9,
  gear: 1.7,
  share: 1.9,
  check: 2.4,
  globe: 1.7,
  ruler: 1.7,
};

type Props = { name: IconName; size?: number; color: string; strokeWidth?: number };

export function Icon({ name, size = 22, color, strokeWidth }: Props) {
  const sw = strokeWidth ?? STROKE_WIDTH[name] ?? 1.8;
  const vb = VIEWBOX[name] ?? 24;
  const common = {
    stroke: color,
    strokeWidth: sw,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} fill="none">
      {ICONS[name].map((s, i) => {
        if ("p" in s) return <Path key={i} d={s.p} {...common} />;
        if ("r" in s) {
          return (
            <Rect
              key={i}
              x={s.r.x}
              y={s.r.y}
              width={s.r.w}
              height={s.r.h}
              rx={s.r.rx}
              {...common}
            />
          );
        }
        if (s.c.solid) return <Circle key={i} cx={s.c.cx} cy={s.c.cy} r={s.c.r} fill={color} />;
        return <Circle key={i} cx={s.c.cx} cy={s.c.cy} r={s.c.r} {...common} />;
      })}
    </Svg>
  );
}
