import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Card, Icon, IconButton, Label, Num } from "@/components/ui";
import { Screen } from "@/components/ui/Screen";
import { EXERCISES, exerciseByName } from "@/features/training/catalog";
import { useTraining } from "@/features/training/store";
import { useUnits } from "@/features/training/units";
import { colors } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import { LineChart } from "./LineChart";
import { plateauLength, seriesFor } from "./series";

/** Exercise progress (design screen 9): chart, started vs current, next target, plateau warning. */
export function ProgressScreen() {
  const router = useRouter();
  const units = useUnits();
  const { prs } = useTraining();
  const { exercise: name } = useLocalSearchParams<{ exercise?: string }>();
  const ex = (name ? exerciseByName(name) : undefined) ?? EXERCISES.bench!;

  const data = seriesFor(ex);
  const started = data[0]!.v;
  const current = data[data.length - 1]!.v;
  const gain = Math.round(((current - started) / started) * 100);
  const nextTarget = current + 2.5;
  const stuck = plateauLength(data);
  const pr = prs[ex.name]?.kg ?? ex.prKg;

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
            PR {units.show(pr)} {units.label}
          </Text>
        </View>
      </View>

      <View>
        <Label size={11}>Exercise progress</Label>
        <Text style={styles.name}>{ex.name.toUpperCase()}</Text>
      </View>

      <Card style={{ paddingTop: 16, paddingHorizontal: 14, paddingBottom: 8 }}>
        <View style={styles.chartHead}>
          <Label size={10}>Working weight</Label>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
            <Num size={26}>{units.show(current)}</Num>
            <Num size={13} color={colors.sub}>
              {units.label}
            </Num>
          </View>
        </View>
        <LineChart data={data} fmt={units.show} />
      </Card>

      <View style={styles.pair}>
        <Card style={styles.half}>
          <Label size={10}>Started</Label>
          <View style={styles.big}>
            <Num size={34} color={colors.sub}>
              {units.show(started)}
            </Num>
            <Num size={15} color={colors.sub}>
              {units.label}
            </Num>
          </View>
          <Text style={styles.small}>8 weeks ago</Text>
        </Card>
        <Card style={[styles.half, { borderWidth: 1, borderColor: colors.limeBorder }]}>
          <Label size={10} color={colors.ink}>
            Current
          </Label>
          <View style={styles.big}>
            <Num size={34}>{units.show(current)}</Num>
            <Num size={15} color={colors.sub}>
              {units.label}
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
        <View>
          <Label size={10} color="rgba(255,255,255,0.5)">
            Next session target
          </Label>
          <View style={[styles.big, { gap: 8 }]}>
            <Num size={36} color={colors.lime}>
              {units.show(nextTarget)}
            </Num>
            <Num size={16} color="rgba(255,255,255,0.6)">
              {units.label}
            </Num>
            <Text style={styles.targetReps}>× {ex.lastReps}</Text>
          </View>
        </View>
        <View style={styles.targetArrow}>
          <Icon name="arrowRight" size={20} color={colors.ink} />
        </View>
      </Card>

      {stuck >= 3 ? (
        <View style={styles.plateau}>
          <View style={styles.bang}>
            <Text style={styles.bangText}>!</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.plateauTitle}>
              Stuck at {units.show(current)} {units.label} for {stuck} sessions
            </Text>
            <Text style={styles.plateauBody}>Consider a deload week to break the plateau.</Text>
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
    alignItems: "center",
    justifyContent: "space-between",
  },
  targetReps: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
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
    backgroundColor: colors.plateauBg,
    borderLeftWidth: 3,
    borderLeftColor: colors.plateau,
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
    borderColor: colors.plateau,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  bangText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.plateau, lineHeight: 15 },
  plateauTitle: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.plateauTitle },
  plateauBody: { fontFamily: fonts.body, fontSize: 12, color: colors.plateauBody, marginTop: 2 },
});
