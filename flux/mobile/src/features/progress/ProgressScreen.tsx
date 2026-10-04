import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Card, Icon, IconButton, Label, Num } from "@/components/ui";
import { Screen } from "@/components/ui/Screen";
import { useUnits } from "@/features/auth/units";
import { EXERCISES, exerciseByName } from "@/features/training/catalog";
import { useTraining } from "@/features/training/store";
import { colors, radii, space } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import { analyzeProgress } from "./analysis";
import {
  EmptyChart,
  NextTargetCard,
  PlateauBanner,
  StartedVsCurrent,
  SummaryGrid,
} from "./components/Sections";
import type { ValueFmt } from "./components/Sections";
import { LineChart } from "./LineChart";

/** Exercise progress (design screen 9): plain-language summary, chart, next target, plateau. */
export function ProgressScreen() {
  const router = useRouter();
  const units = useUnits();
  const { prs, sessions, targetOf } = useTraining();
  const { exercise: name } = useLocalSearchParams<{ exercise?: string }>();
  const ex = (name ? exerciseByName(name) : undefined) ?? EXERCISES.bench!;

  const p = analyzeProgress(ex, prs, sessions);
  const target = targetOf(ex);
  const fmt: ValueFmt = p.repsMetric
    ? { show: (n) => String(n), unit: p.repsUnit }
    : { show: units.show, unit: units.label };

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
            PR {fmt.show(p.best)} {fmt.unit}
          </Text>
        </View>
      </View>

      <View>
        <Label size={11}>Exercise progress</Label>
        <Text style={styles.name}>{ex.name.toUpperCase()}</Text>
      </View>

      {p.hasHistory ? <SummaryGrid p={p} fmt={fmt} /> : <EmptyChart name={ex.name} />}

      {p.hasHistory ? (
        <>
          <Card style={{ paddingTop: space.lg, paddingHorizontal: 14, paddingBottom: space.sm }}>
            <View style={styles.chartHead}>
              <Label size={10}>Working weight</Label>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: space.xs }}>
                <Num size={26}>{fmt.show(p.current)}</Num>
                <Num size={13} color={colors.sub}>
                  {fmt.unit}
                </Num>
              </View>
            </View>
            <LineChart data={p.data} fmt={fmt.show} />
          </Card>

          <StartedVsCurrent p={p} fmt={fmt} />
        </>
      ) : null}
      <NextTargetCard target={target} fmt={fmt} repsMetric={p.repsMetric} />
      {p.plateau ? <PlateauBanner /> : null}
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
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: space.md,
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
});
