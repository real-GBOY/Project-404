import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Card, ChoiceSheet, Icon, IconButton, Label, Num, SectionLabel } from "@/components/ui";
import { Screen } from "@/components/ui/Screen";
import { monthPrCount, monthStats } from "@/features/training/metrics";
import { useTraining } from "@/features/training/store";
import {
  formatMonthTitle,
  formatSessionDate,
  isSameDay,
  monthGrid,
  WEEKDAY_SHORT,
} from "@/lib/dates";
import { colors, em } from "@/theme/tokens";
import { fonts } from "@/theme/typography";

const ALL = "All workouts";

export function HistoryScreen() {
  const router = useRouter();
  const { sessions, prs } = useTraining();
  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [filter, setFilter] = useState<string>(ALL);
  const [filterOpen, setFilterOpen] = useState(false);

  const filterOptions = useMemo(
    () => [ALL, ...Array.from(new Set(sessions.map((s) => s.day)))],
    [sessions],
  );
  const visible = sessions.filter((s) => filter === ALL || s.day === filter);

  const { offset, days } = monthGrid(cursor.y, cursor.m);
  const trainedDays = new Set(
    visible
      .filter((s) => {
        const d = new Date(s.date);
        return d.getFullYear() === cursor.y && d.getMonth() === cursor.m;
      })
      .map((s) => new Date(s.date).getDate()),
  );
  const isCurrentMonth = cursor.y === today.getFullYear() && cursor.m === today.getMonth();
  const shift = (delta: number) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };

  const stats = monthStats(visible, cursor.y, cursor.m);
  const monthSessions = visible.filter((s) => {
    const d = new Date(s.date);
    return d.getFullYear() === cursor.y && d.getMonth() === cursor.m;
  });

  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];

  return (
    <Screen tabBarClearance>
      <View style={styles.header}>
        <Text style={styles.title}>HISTORY</Text>
        <IconButton label="Filter workouts" onPress={() => setFilterOpen(true)}>
          <Icon name="filter" size={19} color={filter === ALL ? colors.ink : colors.limeDim} />
        </IconButton>
      </View>
      {filter !== ALL ? (
        <Text style={styles.filterNote}>
          Showing {filter.toLowerCase()} only ·{" "}
          <Text style={{ color: colors.limeDeep }} onPress={() => setFilter(ALL)}>
            clear
          </Text>
        </Text>
      ) : null}

      {/* calendar */}
      <Card style={{ padding: 16 }}>
        <View style={styles.monthRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            onPress={() => shift(-1)}
            style={styles.monthBtn}
          >
            <Icon name="back" size={16} color={colors.ink} />
          </Pressable>
          <Text style={styles.month}>{formatMonthTitle(new Date(cursor.y, cursor.m, 1))}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next month"
            onPress={() => shift(1)}
            style={styles.monthBtn}
          >
            <Icon name="chevR" size={16} color={colors.ink} />
          </Pressable>
        </View>
        <View style={styles.grid}>
          {WEEKDAY_SHORT.map((d, i) => (
            <Text key={i} style={styles.dow}>
              {d}
            </Text>
          ))}
        </View>
        <View style={styles.grid}>
          {cells.map((n, i) => {
            if (n === null) return <View key={`b${i}`} style={styles.cell} />;
            const trained = trainedDays.has(n);
            const isToday = isCurrentMonth && isSameDay(new Date(cursor.y, cursor.m, n), today);
            return (
              <View key={n} style={styles.cell}>
                <View
                  style={[
                    styles.day,
                    trained && { backgroundColor: colors.lime },
                    !trained && !isToday && { backgroundColor: colors.soft },
                    isToday && { borderWidth: 2, borderColor: colors.lime },
                  ]}
                >
                  <Num size={14} color={trained || isToday ? colors.ink : colors.sub}>
                    {n}
                  </Num>
                </View>
              </View>
            );
          })}
        </View>
      </Card>

      {/* month stats */}
      <View>
        <SectionLabel>
          {isCurrentMonth ? "This month" : formatMonthTitle(new Date(cursor.y, cursor.m, 1))}
        </SectionLabel>
        <View style={styles.statRow}>
          {[
            { n: String(stats.sessions), l: "Sessions" },
            { n: String(Math.round(stats.volumeKg / 1000)), u: "T", l: "Volume" },
            { n: String(monthPrCount(prs, cursor.y, cursor.m)), l: "New PRs" },
          ].map((s) => (
            <Card key={s.l} style={styles.stat}>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2 }}>
                <Num size={28}>{s.n}</Num>
                {s.u ? (
                  <Num size={15} color={colors.sub}>
                    {s.u}
                  </Num>
                ) : null}
              </View>
              <Label size={9.5}>{s.l}</Label>
            </Card>
          ))}
        </View>
      </View>

      {/* sessions */}
      <View>
        <SectionLabel>Past sessions</SectionLabel>
        <View style={{ gap: 9, marginTop: 10 }}>
          {monthSessions.length === 0 ? (
            <Card style={{ padding: 20 }}>
              <Text style={styles.empty}>No sessions this month.</Text>
            </Card>
          ) : (
            monthSessions.map((s) => (
              <Card
                key={s.id}
                style={styles.session}
                onPress={() =>
                  router.push({ pathname: "/progress", params: { exercise: s.top.name } })
                }
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.sessionName}>{s.day}</Text>
                  <Text style={styles.sessionDate}>{formatSessionDate(new Date(s.date))}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2 }}>
                    <Num size={20}>{(s.volumeKg / 1000).toFixed(1)}</Num>
                    <Num size={12} color={colors.sub}>
                      T
                    </Num>
                  </View>
                  <Text style={styles.sessionMin}>{s.minutes} min</Text>
                </View>
                <Icon name="chevR" size={16} color={colors.sub} />
              </Card>
            ))
          )}
        </View>
      </View>

      <ChoiceSheet
        visible={filterOpen}
        title="FILTER"
        options={filterOptions}
        value={filter}
        onSelect={setFilter}
        onClose={() => setFilterOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.ink,
    letterSpacing: em(28, 0.04),
  },
  filterNote: { fontFamily: fonts.body, fontSize: 12, color: colors.sub, marginTop: -8 },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  monthBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  month: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink },
  grid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 2 },
  dow: {
    width: `${100 / 7}%`,
    textAlign: "center",
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: colors.sub,
    marginBottom: 8,
  },
  cell: { width: `${100 / 7}%`, alignItems: "center", paddingVertical: 3 },
  day: { width: 30, height: 30, borderRadius: 99, alignItems: "center", justifyContent: "center" },
  statRow: { flexDirection: "row", gap: 12, marginTop: 10 },
  stat: { flex: 1, paddingVertical: 14, paddingHorizontal: 12, gap: 6 },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.sub, textAlign: "center" },
  session: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderLeftWidth: 3,
    borderLeftColor: colors.lime,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sessionName: { fontFamily: fonts.display, fontSize: 19, color: colors.ink, letterSpacing: 0.57 },
  sessionDate: { fontFamily: fonts.body, fontSize: 11, color: colors.sub, marginTop: 2 },
  sessionMin: { fontFamily: fonts.body, fontSize: 10.5, color: colors.sub },
});
