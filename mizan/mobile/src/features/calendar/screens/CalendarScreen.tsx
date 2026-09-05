import { useMemo } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet, RefreshControl } from "react-native";
import { useRefresh } from "@/lib/use-refresh";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatDate, formatTime } from "@/lib/format";
import { colors, radii } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FAB } from "@/components/ui/FAB";
import { notAvailableYet } from "@/lib/not-available";
import { useCalendarRange } from "../hooks";
import type { CalendarItem } from "../types";

const KIND_COLOR: Record<CalendarItem["kind"], string> = {
  deadline: colors.dangerAccent,
  hearing: colors.brandBronze,
  event: colors.textMuted,
};

const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export default function CalendarScreen() {
  const { t } = useTranslation("calendar");
  const insets = useSafeAreaInsets();

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59).toISOString();
  const { data, isLoading, refetch } = useCalendarRange(from, to);
  const { refreshing, onRefresh } = useRefresh(refetch);

  const items = useMemo(
    () => [...(data?.items ?? [])].sort((a, b) => (a.at < b.at ? -1 : 1)),
    [data],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const it of items) {
      const k = dayKey(it.at);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    }
    return [...map.entries()];
  }, [items]);

  const daysWithItems = useMemo(() => new Set(items.map((it) => dayKey(it.at))), [items]);

  // Current week strip (Sun–Sat containing today).
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{formatDate(now, { month: "long" })}</Text>
          <Pressable onPress={() => notAvailableYet(t("title"))} hitSlop={8}>
            <Icon name="filter_list" size={23} color={colors.brandDeep} />
          </Pressable>
          <IconButton icon="add" onPress={() => notAvailableYet(t("title"))} />
        </View>
        <View style={styles.week}>
          {week.map((d) => {
            const isToday = d.toDateString() === now.toDateString();
            const has = daysWithItems.has(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
            return (
              <View key={d.toISOString()} style={styles.weekCol}>
                <Text style={styles.weekLabel}>
                  {d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}
                </Text>
                <View style={[styles.weekCell, isToday && styles.weekCellToday]}>
                  <Text style={[styles.weekNum, isToday && styles.weekNumToday]}>{d.getDate()}</Text>
                </View>
                {has ? <View style={styles.weekDot} /> : <View style={{ height: 7 }} />}
              </View>
            );
          })}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandDark} />
        </View>
      ) : grouped.length === 0 ? (
        <EmptyState icon="calendar_month" title={t("empty")} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandDark} />}
        >
          {grouped.map(([key, dayItems]) => (
            <View key={key}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayHeaderText}>
                  {formatDate(dayItems[0].at, { weekday: "short", day: "numeric", month: "short" }).toUpperCase()}
                </Text>
                <View style={styles.rule} />
              </View>
              <View style={{ gap: 10 }}>
                {dayItems.map((it) => (
                  <Pressable
                    key={it.id}
                    style={styles.eventCard}
                    onPress={() => {
                      if (it.kind === "hearing") router.push(`/hearings/${it.id}`);
                      else if (it.matterId) router.push(`/case/${it.matterId}`);
                    }}
                  >
                    <View style={[styles.eventAccent, { backgroundColor: KIND_COLOR[it.kind] }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.eventTitle} numberOfLines={2}>
                        {it.title}
                      </Text>
                      <Text style={styles.eventSub} numberOfLines={1}>
                        {[formatTime(it.at), it.matterTitle, it.owner].filter(Boolean).join(" · ")}
                      </Text>
                    </View>
                    {it.kind === "hearing" ? (
                      <Icon name="chevron_right" size={20} color={colors.chevronMuted} />
                    ) : null}
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
      <FAB />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 20,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { flex: 1, fontFamily: fontFamily.extrabold, fontSize: fontSize.displayLg, letterSpacing: -0.3, color: colors.textPrimary },
  week: { flexDirection: "row", justifyContent: "space-between", marginTop: 16, paddingBottom: 14 },
  weekCol: { width: 42, alignItems: "center" },
  weekLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.xs, color: colors.textSecondary },
  weekCell: { width: 36, height: 36, marginTop: 6, borderRadius: radii.md, alignItems: "center", justifyContent: "center" },
  weekCellToday: { backgroundColor: colors.brandDark },
  weekNum: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.chipInactiveText },
  weekNumToday: { fontFamily: fontFamily.extrabold, color: colors.textOnDark },
  weekDot: { width: 5, height: 5, borderRadius: radii.pill, backgroundColor: colors.dangerAccent, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 20, gap: 16, paddingBottom: 100 },
  dayHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  dayHeaderText: { fontFamily: fontFamily.extrabold, fontSize: fontSize.sm, letterSpacing: 0.8, color: colors.textSecondary },
  rule: { flex: 1, height: 1, backgroundColor: colors.borderSectionRule },
  eventCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lgXl,
    padding: 14,
  },
  eventAccent: { width: 3, alignSelf: "stretch", borderRadius: radii.pill },
  eventTitle: { fontFamily: fontFamily.extrabold, fontSize: fontSize.mdLg, color: colors.textPrimary },
  eventSub: { fontFamily: fontFamily.medium, fontSize: fontSize.base, color: colors.textSecondary, marginTop: 3 },
});
