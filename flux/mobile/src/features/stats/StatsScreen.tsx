import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Card, Icon, Label, Num, SectionLabel } from "@/components/ui";
import { Screen } from "@/components/ui/Screen";
import { EXERCISES, STATS_PR_IDS } from "@/features/training/catalog";
import { muscleSets, volumeInWindow, weekTonnes } from "@/features/training/metrics";
import { useTraining } from "@/features/training/store";
import { useUnits } from "@/features/training/units";
import { formatShortDate, mondayIndex, WEEKDAY_SHORT } from "@/lib/dates";
import { colors, em, limeAlpha } from "@/theme/tokens";
import { fonts } from "@/theme/typography";

const BAR_MAX = 72;

export function StatsScreen() {
  const router = useRouter();
  const units = useUnits();
  const { sessions, prs } = useTraining();
  const now = new Date();

  // Rolling 30-day windows (a calendar month is empty on the 1st).
  const recentKg = volumeInWindow(sessions, now, 0, 30);
  const priorKg = volumeInWindow(sessions, now, 30, 60);
  const change = priorKg ? Math.round(((recentKg - priorKg) / priorKg) * 100) : null;

  const week = weekTonnes(sessions, now);
  const maxV = Math.max(...week, 0.1);
  const todayIdx = mondayIndex(now);

  const muscles = muscleSets(sessions, now);
  const maxSets = Math.max(...muscles.map((m) => m.sets), 1);

  const volumeText = Math.round(
    units.label === "LBS" ? recentKg * 2.20462 : recentKg,
  ).toLocaleString("en-US");

  return (
    <Screen tabBarClearance>
      <View style={styles.titleRow}>
        <Text style={styles.title}>YOUR STATS</Text>
        <Text style={styles.sub}>Last 30 days</Text>
      </View>

      {/* hero volume */}
      <Card dark style={{ padding: 22, overflow: "hidden" }}>
        <Label size={11} color={colors.whiteA50}>
          Total volume lifted
        </Label>
        <View style={styles.hero}>
          <Text style={styles.heroNum} adjustsFontSizeToFit numberOfLines={1}>
            {volumeText}
          </Text>
          <Num size={26} color={colors.lime}>
            {units.label}
          </Num>
        </View>
        {change !== null ? (
          <View style={styles.change}>
            {change >= 0 ? <Icon name="arrowUp" size={13} color={colors.lime} /> : null}
            <Text style={styles.changePct}>
              {change >= 0 ? "+" : ""}
              {change}%
            </Text>
            <Text style={styles.changeText}>vs previous 30 days</Text>
          </View>
        ) : null}
      </Card>

      {/* weekly bars */}
      <Card style={{ paddingTop: 16, paddingHorizontal: 16, paddingBottom: 14 }}>
        <View style={styles.cardHead}>
          <Label size={11} color={colors.ink} weight="semi">
            This week
          </Label>
          <Text style={styles.sub}>tonnes / day</Text>
        </View>
        <View style={styles.bars}>
          {week.map((v, i) => {
            const isNow = i === todayIdx;
            return (
              <View key={i} style={styles.barCol}>
                {v > 0 ? (
                  <Text style={[styles.barValue, { color: isNow ? colors.ink : colors.sub }]}>
                    {v}
                  </Text>
                ) : null}
                <View
                  style={[
                    styles.bar,
                    {
                      height: v === 0 ? 4 : Math.max(8, Math.round((v / maxV) * BAR_MAX)),
                      backgroundColor: v === 0 ? colors.hair : isNow ? colors.lime : colors.limeBar,
                    },
                    isNow && styles.barNow,
                  ]}
                />
                <Text style={[styles.barDay, { color: isNow ? colors.ink : colors.sub }]}>
                  {WEEKDAY_SHORT[i]}
                </Text>
              </View>
            );
          })}
        </View>
      </Card>

      {/* PRs */}
      <View>
        <SectionLabel>Personal records</SectionLabel>
        <View style={{ gap: 8, marginTop: 10 }}>
          {STATS_PR_IDS.map((id) => {
            const ex = EXERCISES[id]!;
            const pr = prs[ex.name];
            return (
              <Card
                key={id}
                style={styles.pr}
                onPress={() =>
                  router.push({ pathname: "/progress", params: { exercise: ex.name } })
                }
              >
                <View style={styles.trophy}>
                  <Icon name="trophy" size={18} color={colors.limeDim} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.prName}>{ex.name}</Text>
                  <Text style={styles.prDate}>{pr ? formatShortDate(new Date(pr.date)) : "—"}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                  <Num size={28}>{units.show(pr?.kg ?? ex.prKg)}</Num>
                  <Num size={14} color={colors.sub}>
                    {units.label}
                  </Num>
                </View>
              </Card>
            );
          })}
        </View>
      </View>

      {/* muscle focus */}
      <View>
        <View style={[styles.cardHead, { paddingLeft: 2, marginBottom: 10 }]}>
          <Label size={11} color={colors.ink} weight="semi">
            Muscle focus
          </Label>
          <View style={styles.legend}>
            <Text style={styles.legendText}>Low</Text>
            <View style={{ flexDirection: "row", gap: 2 }}>
              {[0.25, 0.5, 0.75, 1].map((o) => (
                <View key={o} style={[styles.legendBox, { backgroundColor: limeAlpha(o) }]} />
              ))}
            </View>
            <Text style={styles.legendText}>High</Text>
          </View>
        </View>
        <Card style={{ padding: 12 }}>
          <View style={styles.muscles}>
            {muscles.map((m) => (
              <View
                key={m.muscle}
                style={[
                  styles.muscle,
                  { backgroundColor: limeAlpha(0.16 + (m.sets / maxSets) * 0.84) },
                ]}
              >
                <Num size={18}>{m.sets}</Num>
                <Text style={styles.muscleName}>{m.muscle}</Text>
              </View>
            ))}
          </View>
        </Card>
        <Text style={styles.footnote}>Working sets in the last 7 days</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.ink,
    letterSpacing: em(26, 0.04),
  },
  sub: { fontFamily: fonts.body, fontSize: 12, color: colors.sub },
  hero: { flexDirection: "row", alignItems: "baseline", gap: 11, marginTop: 8 },
  heroNum: {
    fontFamily: fonts.display,
    fontSize: 64,
    lineHeight: 68,
    color: colors.white,
    letterSpacing: 0.64,
    flexShrink: 1,
  },
  change: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10 },
  changePct: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.lime },
  changeText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.whiteA50 },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  bars: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 120,
    gap: 8,
  },
  barCol: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 7 },
  barValue: { fontFamily: fonts.display, fontSize: 13 },
  bar: { width: "100%", maxWidth: 26, borderRadius: 7 },
  barNow: {
    shadowColor: colors.lime,
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  barDay: { fontFamily: fonts.bodyMedium, fontSize: 10.5 },
  pr: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  trophy: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.limeTintStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  prName: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.ink },
  prDate: { fontFamily: fonts.body, fontSize: 11, color: colors.sub },
  legend: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendText: { fontFamily: fonts.body, fontSize: 10, color: colors.sub },
  legendBox: { width: 10, height: 10, borderRadius: 3 },
  muscles: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  muscle: {
    width: "31.5%",
    flexGrow: 1,
    height: 64,
    borderRadius: 12,
    padding: 11,
    justifyContent: "space-between",
  },
  muscleName: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.ink },
  footnote: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.sub,
    marginTop: 8,
    paddingLeft: 2,
  },
});
