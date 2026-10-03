import { View } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { colors } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import type { Point } from "./series";

type P = { x: number; y: number };

function smoothPath(pts: P[]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

const W = 312;
const H = 150;
const PAD = { l: 30, r: 8, t: 14, b: 22 };

/** Working-weight line chart (design screen 9). `fmt` renders axis labels in the user's unit. */
export function LineChart({ data, fmt }: { data: Point[]; fmt: (kg: number) => string }) {
  const values = data.map((d) => d.v);
  const min = Math.floor((Math.min(...values) - 5) / 10) * 10;
  const max = Math.ceil((Math.max(...values) + 5) / 10) * 10;
  const xs = (i: number) => PAD.l + (i * (W - PAD.l - PAD.r)) / (data.length - 1);
  const ys = (v: number) => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b);
  const pts = data.map((d, i) => ({ x: xs(i), y: ys(d.v), label: d.label }));
  const line = smoothPath(pts);
  const area = `${line} L ${pts[pts.length - 1]!.x} ${H - PAD.b} L ${pts[0]!.x} ${H - PAD.b} Z`;
  const ticks = Array.from({ length: 5 }, (_, i) => min + ((max - min) * i) / 4);

  return (
    <View style={{ width: "100%", aspectRatio: W / H }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <LinearGradient id="fluxArea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={colors.lime} stopOpacity={0.22} />
            <Stop offset="100%" stopColor={colors.lime} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {ticks.map((t) => (
          <G key={t}>
            <Line
              x1={PAD.l}
              y1={ys(t)}
              x2={W - PAD.r}
              y2={ys(t)}
              stroke={colors.chartGrid}
              strokeWidth={1}
            />
            <SvgText
              x={PAD.l - 8}
              y={ys(t) + 3.5}
              textAnchor="end"
              fontFamily={fonts.body}
              fontSize={9}
              fill={colors.chartLabel}
            >
              {fmt(t)}
            </SvgText>
          </G>
        ))}
        {pts.map((p, i) => (
          <SvgText
            key={i}
            x={p.x}
            y={H - 6}
            textAnchor="middle"
            fontFamily={fonts.body}
            fontSize={9}
            fill={colors.chartLabel}
          >
            {p.label}
          </SvgText>
        ))}
        <Path d={area} fill="url(#fluxArea)" />
        <Path
          d={line}
          fill="none"
          stroke={colors.lime}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {pts.map((p, i) =>
          i === pts.length - 1 ? (
            <G key={i}>
              <Circle cx={p.x} cy={p.y} r={7.5} fill={colors.lime} />
              <Circle cx={p.x} cy={p.y} r={3.2} fill={colors.ink} />
            </G>
          ) : (
            <Circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={3}
              fill={colors.white}
              stroke={colors.lime}
              strokeWidth={2}
            />
          ),
        )}
      </Svg>
    </View>
  );
}
