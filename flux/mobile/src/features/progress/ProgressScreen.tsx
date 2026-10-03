import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Card, Icon, IconButton, Label, Num } from "@/components/ui";
import { Screen } from "@/components/ui/Screen";
import { EXERCISES, exerciseByName, trackingOf } from "@/features/training/catalog";
import { useTraining } from "@/features/training/store";
import { useUnits } from "@/features/training/units";
import { colors } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import { LineChart } from "./LineChart";
import { isPlateau, repRange, trendOf } from "@/features/training/engine";
import { chartsReps, seriesFor } from "./series";

/** Exercise progress (design screen 9): chart, started vs current, next target, plateau warning. */
export function ProgressScreen() {
  const router = useRouter();
  const units = useUnits();
  const { prs, targetOf } = useTraining();
  const { exercise: name } = useLocalSearchParams<{ exercise?: string }>();
  const ex = (name ? exerciseByName(name) : undefined) ?? EXERCISES.bench!;

  const data = seriesFor(ex);
  const started = data[0]!.v;
  const current = data[data.length - 1]!.v;
  const gain = Math.round(((current - started) / started) * 100);
  const lastPoint = data[data.length - 1]!;
  const target = targetOf(ex);
  const trend = trendOf(data.map((d) => d.v));
  const plateau = isPlateau(
    data.map((d) => ({ kg: d.v, reps: d.reps })),
    repRange(ex).high,
  );
  const repsMetric = chartsReps(ex);
  const show = repsMetric ? (n: number) => String(n) : units.show;
  const unitLabel = repsMetric ? (trackingOf(ex) === "time" ? "SEC" : "REPS") : units.label;
  const pr = repsMetric ? Math.max(...data.map((d) => d.v)) : (prs[ex.name]?.kg ?? ex.prKg);
  const prReps = Math.max(1, Math.round(ex.lastReps / 2));
  const targetValue = repsMetric ? target.repLow : target.kg;
  const trendColor =
    trend === "Improving"
      ? colors.limeDeep
      : trend === "Declining"
        ? colors.plateauTitle
        : colors.sub;

  return (
    <Screen gap={16}>
      <View style={styles.header}>
        <IconButton
          label="Back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/home"))}
        >
          <Icon name="back" size={20} color={colors.ink} />
        </IconButton>
        <View style={styles.prChip}>
          <Icon name="trophy" size={15} color={colors.limeDim} />
          <Text style={styles.prText}>
            PR {show(pr)} {unitLabel}
          </Text>
        </View>
      </View>

      <View>
        <Label size={11}>Exercise progress</Label>
        <Text style={styles.name}>{ex.name.toUpperCase()}</Text>
      </View>

      {/* plain-language summary: Current / Best / Recent / Trend */}
      <View style={styles.grid}>
        <Card style={styles.cell}>
          <Label size={10}>Current</Label>
          <View style={styles.cellVal}>
            <Num size={24}>{show(current)}</Num>
            <Num size={13} color={colors.sub}>
              {repsMetric ? "" : `${unitLabel} × ${lastPoint.reps}`}
            </Num>
          </View>
        </Card>
        <Card style={styles.cell}>
          <Label size={10}>Best</Label>
          <View style={styles.cellVal}>
            <Num size={24} color={colors.limeDim}>
              {show(pr)}
            </Num>
            <Num size={13} color={colors.sub}>
              {repsMetric ? "" : `${unitLabel} × ${prReps}`}
            </Num>
          </View>
        </Card>
        <Card style={styles.cell}>
          <Label size={10}>Recent sessions</Label>
          <Text style={styles.logged}>{data.length} logged</Text>
        </Card>
        <Card style={[styles.cell, { justifyContent: "center" }]}>
          <Label size={10}>Trend</Label>
          <View style={styles.trendRow}>
            {trend === "Improving" ? (
              <Icon name="arrowUp" size={15} color={trendColor} />
            ) : trend === "Declining" ? (
              <View style={{ transform: [{ rotate: "180deg" }] }}>
                <Icon name="arrowUp" size={15} color={trendColor} />
              </View>
            ) : null}
            <Text style={[styles.trendText, { color: trendColor }]}>{trend}</Text>
          </View>
        </Card>
      </View>

      <Card style={{ paddingTop: 16, paddingHorizontal: 14, paddingBottom: 8 }}>
        <View style={styles.chartHead}>
          <Label size={10}>Working weight</Label>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
            <Num size={26}>{show(current)}</Num>
            <Num size={13} color={colors.sub}>
              {unitLabel}
            </Num>
          </View>
        </View>
        <LineChart data={data} fmt={show} />
      </Card>

      <View style={styles.pair}>
        <Card style={styles.half}>
          <Label size={10}>Started</Label>
          <View style={styles.big}>
            <Num size={34} color={colors.sub}>
              {show(started)}
            </Num>
            <Num size={15} color={colors.sub}>
              {unitLabel}
            </Num>
          </View>
          <Text style={styles.small}>8 sessions ago</Text>
        </Card>
        <Card style={[styles.half, { borderWidth: 1, borderColor: colors.limeBorder }]}>
          <Label size={10} color={colors.ink}>
            Current
          </Label>
          <View style={styles.big}>
            <Num size={34}>{show(current)}</Num>
            <Num size={15} color={colors.sub}>
              {unitLabel}
            </Num>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Icon name="arrowUp" size={11} color={colors.limeDim} />
            <Text style={[styles.small, { fontFamily: fonts.bodySemi, color: colors.limeDeep }]}>
              +{gain}% gain
            </Text>
          </View>
        </Card>
      </View>

      <Card dark style={styles.target}>
        <View style={{ flex: 1 }}>
          <Label size={10} color={colors.whiteA50}>
            Next session target
          </Label>
          <View style={[styles.big, { gap: 8 }]}>
            <Num size={36} color={colors.lime}>
              {show(targetValue)}
            </Num>
            <Num size={16} color={colors.whiteA60}>
              {unitLabel}
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

      {plateau ? (
        <View style={styles.plateau}>
          <View style={styles.bang}>
            <Text style={styles.bangText}>!</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.plateauTitle}>Plateau detected</Text>
            <Text style={styles.plateauBody}>
              Your recent performance has stayed within the same range. Consider staying at this
              weight and building reps.
            </Text>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  prChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.limeTintStrong,
    borderRadius: 99,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  prText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.limeDeep },
  name: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 38,
    color: colors.ink,
    letterSpacing: 0.68,
    marginTop: 3,
  },
  chartHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
  pair: { flexDirection: "row", gap: 12 },
  half: { flex: 1, padding: 16 },
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
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cell: { width: "47.5%", flexGrow: 1, padding: 14 },
  cellVal: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 7 },
  logged: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.ink, marginTop: 9 },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  trendText: { fontFamily: fonts.bodySemi, fontSize: 14 },
  targetReps: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.whiteA60,
    marginLeft: 2,
  },
  targetArrow: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  plateau: {
    backgroundColor: colors.warnBg,
    borderLeftWidth: 3,
    borderLeftColor: colors.warn,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  bang: {
    width: 22,
    height: 22,
    borderRadius: 99,
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
