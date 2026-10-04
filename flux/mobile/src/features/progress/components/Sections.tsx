import { StyleSheet, Text, View } from "react-native";
import { Card, Icon, Label, Num } from "@/components/ui";
import type { Target } from "@/features/training/engine";
import { colors, radii, space } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import type { Progress } from "../analysis";

/** How values are written on this screen (kg → the user's unit, or reps / seconds). */
export type ValueFmt = { show: (n: number) => string; unit: string };

const trendColor = (t: Progress["trend"]) =>
  t === "Improving" ? colors.limeDeep : t === "Declining" ? colors.plateauTitle : colors.sub;

/** Current / Best / Recent sessions / Trend in plain language. */
export function SummaryGrid({ p, fmt }: { p: Progress; fmt: ValueFmt }) {
  const color = trendColor(p.trend);
  return (
    <View style={styles.grid}>
      <Card style={styles.cell}>
        <Label size={10}>Current</Label>
        <View style={styles.cellVal}>
          <Num size={24}>{fmt.show(p.current)}</Num>
          <Num size={13} color={colors.sub}>
            {p.repsMetric ? "" : `${fmt.unit} × ${p.currentReps}`}
          </Num>
        </View>
      </Card>
      <Card style={styles.cell}>
        <Label size={10}>Best</Label>
        <View style={styles.cellVal}>
          <Num size={24} color={colors.limeDim}>
            {fmt.show(p.best)}
          </Num>
          <Num size={13} color={colors.sub}>
            {p.repsMetric ? "" : `${fmt.unit} × ${p.bestReps}`}
          </Num>
        </View>
      </Card>
      <Card style={styles.cell}>
        <Label size={10}>Recent sessions</Label>
        <Text style={styles.logged}>{p.data.length} logged</Text>
      </Card>
      <Card style={[styles.cell, { justifyContent: "center" }]}>
        <Label size={10}>Trend</Label>
        <View style={styles.trendRow}>
          {p.trend === "Improving" ? <Icon name="arrowUp" size={15} color={color} /> : null}
          {p.trend === "Declining" ? (
            <View style={{ transform: [{ rotate: "180deg" }] }}>
              <Icon name="arrowUp" size={15} color={color} />
            </View>
          ) : null}
          <Text style={[styles.trendText, { color }]}>{p.trend}</Text>
        </View>
      </Card>
    </View>
  );
}

/** "Started" vs "Current" with the percentage gain. */
export function StartedVsCurrent({ p, fmt }: { p: Progress; fmt: ValueFmt }) {
  return (
    <View style={styles.pair}>
      <Card style={styles.half}>
        <Label size={10}>Started</Label>
        <View style={styles.big}>
          <Num size={34} color={colors.sub}>
            {fmt.show(p.started)}
          </Num>
          <Num size={15} color={colors.sub}>
            {fmt.unit}
          </Num>
        </View>
        <Text style={styles.small}>8 sessions ago</Text>
      </Card>
      <Card style={[styles.half, { borderWidth: 1, borderColor: colors.limeBorder }]}>
        <Label size={10} color={colors.ink}>
          Current
        </Label>
        <View style={styles.big}>
          <Num size={34}>{fmt.show(p.current)}</Num>
          <Num size={15} color={colors.sub}>
            {fmt.unit}
          </Num>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
          <Icon name="arrowUp" size={11} color={colors.limeDim} />
          <Text style={[styles.small, { fontFamily: fonts.bodySemi, color: colors.limeDeep }]}>
            +{p.gainPct}% gain
          </Text>
        </View>
      </Card>
    </View>
  );
}

/** Dark "next session target" card with the engine's reason. */
export function NextTargetCard({
  target,
  fmt,
  repsMetric,
}: {
  target: Target;
  fmt: ValueFmt;
  repsMetric: boolean;
}) {
  return (
    <Card dark style={styles.target}>
      <View style={{ flex: 1 }}>
        <Label size={10} color={colors.whiteA50}>
          Next session target
        </Label>
        <View style={[styles.big, { gap: space.sm }]}>
          <Num size={36} color={colors.lime}>
            {fmt.show(repsMetric ? target.repLow : target.kg)}
          </Num>
          <Num size={16} color={colors.whiteA60}>
            {fmt.unit}
          </Num>
          {repsMetric ? null : (
            <Text style={styles.targetReps}>
              × {target.repLow}-{target.repHigh}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.targetArrow}>
        <Icon name="arrowRight" size={20} color={colors.ink} />
      </View>
      <Text style={styles.targetReason}>{target.reason}</Text>
    </Card>
  );
}

/** Shown until an exercise has at least two logged sessions. */
export function EmptyChart({ name }: { name: string }) {
  return (
    <Card style={styles.empty}>
      <Text style={styles.emptyTitle}>Your progress starts here</Text>
      <Text style={styles.emptyBody}>
        Log {name} in two workouts and its chart, trend and plateau check appear.
      </Text>
    </Card>
  );
}

/** Calm amber banner, shown only when the engine detects a plateau. */
export function PlateauBanner() {
  return (
    <View style={styles.plateau} accessibilityRole="alert">
      <View style={styles.bang}>
        <Text style={styles.bangText}>!</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.plateauTitle}>Plateau detected</Text>
        <Text style={styles.plateauBody}>
          Your recent performance has stayed within the same range. Consider staying at this weight
          and building reps.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  cell: { width: "47.5%", flexGrow: 1, padding: 14 },
  cellVal: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 7 },
  logged: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.ink, marginTop: 9 },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  trendText: { fontFamily: fonts.bodySemi, fontSize: 14 },
  pair: { flexDirection: "row", gap: space.md },
  half: { flex: 1, padding: space.lg },
  big: { flexDirection: "row", alignItems: "baseline", gap: 7, marginTop: 8 },
  small: { fontFamily: fonts.body, fontSize: 10.5, color: colors.sub },
  target: {
    padding: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
  },
  targetReason: {
    width: "100%",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.whiteA10,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.whiteA55,
  },
  targetReps: { fontFamily: fonts.body, fontSize: 13, color: colors.whiteA60, marginLeft: 2 },
  targetArrow: {
    width: 44,
    height: 44,
    borderRadius: radii.lg,
    backgroundColor: colors.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { padding: space.xl, gap: 6, alignItems: "center" },
  emptyTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, letterSpacing: 0.44 },
  emptyBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.sub,
    textAlign: "center",
  },
  plateau: {
    backgroundColor: colors.warnBg,
    borderLeftWidth: 3,
    borderLeftColor: colors.warn,
    borderRadius: radii.lg,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
    flexDirection: "row",
    gap: space.md,
    alignItems: "flex-start",
  },
  bang: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.warn,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  bangText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.warn, lineHeight: 15 },
  plateauTitle: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.warnTitle },
  plateauBody: { fontFamily: fonts.body, fontSize: 12, color: colors.warnBody, marginTop: 2 },
});
