import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Bar, Card, Icon, Label, Num } from "@/components/ui";
import { useUnits } from "@/features/auth/units";
import { exerciseByName } from "@/features/training/catalog";
import type { PersonalRecord, Session } from "@/features/training/types";
import { weekdayName } from "@/lib/dates";
import { colors, radii, space } from "@/theme/tokens";
import { fonts } from "@/theme/typography";

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());

/** Most recent session's top lift with progress towards its PR. */
export function LastSessionCard({
  session: last,
  prs,
}: {
  session: Session;
  prs: Record<string, PersonalRecord>;
}) {
  const router = useRouter();
  const units = useUnits();
  const lastPr = prs[last.top.name]?.kg ?? exerciseByName(last.top.name)?.prKg ?? last.top.kg;
  const pct = lastPr ? last.top.kg / lastPr : 0;
  return (
    <View>
      <View style={styles.head}>
        <Label color={colors.ink} size={11} weight="semi">
          Last Session
        </Label>
        <Text style={styles.headMeta}>
          {weekdayName(new Date(last.date))} · {titleCase(last.day)}
        </Text>
      </View>
      <Card
        style={{ padding: space.lg }}
        onPress={() => router.push({ pathname: "/progress", params: { exercise: last.top.name } })}
      >
        <View style={styles.row}>
          <View>
            <Text style={styles.name}>{last.top.name.toUpperCase()}</Text>
            <View style={styles.weight}>
              <Num size={32}>{units.show(last.top.kg)}</Num>
              <Num size={16} color={colors.sub}>
                {units.label}
              </Num>
              <Text style={styles.reps}>× {last.top.reps}</Text>
            </View>
          </View>
          {last.top.deltaKg > 0 ? (
            <View style={styles.delta}>
              <Icon name="arrowUp" size={13} color={colors.limeDim} />
              <Text style={styles.deltaText}>
                +{units.show(last.top.deltaKg)}
                {units.short}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={{ marginTop: 14 }}>
          <Bar pct={pct} />
          <View style={styles.barLabels}>
            <Text style={styles.barLabel}>{Math.round(pct * 100)}% to next PR</Text>
            <Text style={styles.barLabel}>
              {units.show(lastPr)} {units.short}
            </Text>
          </View>
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  headMeta: { fontFamily: fonts.body, fontSize: 11, color: colors.sub },
  row: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  name: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, letterSpacing: 0.44 },
  weight: { flexDirection: "row", alignItems: "baseline", gap: space.sm, marginTop: 4 },
  reps: { fontFamily: fonts.body, fontSize: 12, color: colors.sub, marginLeft: 2 },
  delta: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    backgroundColor: colors.limeTintStrong,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
  },
  deltaText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.limeDeep },
  barLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 7 },
  barLabel: { fontFamily: fonts.body, fontSize: 10.5, color: colors.sub },
});
