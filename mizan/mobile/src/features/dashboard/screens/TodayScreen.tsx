import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/use-auth";
import { formatDate, formatTime } from "@/lib/format";
import { colors, radii } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { MatterRefBadge } from "@/components/ui/MatterRefBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { FAB } from "@/components/ui/FAB";
import { useDashboard } from "../hooks";
import { useUnreadNotificationsCount } from "@/features/notifications/hooks";
import { useTaskMutations } from "@/features/tasks/hooks";
import type { DashboardDeadline, DashboardHearing, DashboardTask } from "../types";

function greetingKey(hour: number): string {
  if (hour < 12) return "goodMorning";
  if (hour < 18) return "goodAfternoon";
  return "goodEvening";
}

export default function TodayScreen() {
  const { t } = useTranslation("dashboard");
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useDashboard();
  const unread = useUnreadNotificationsCount();
  const { complete } = useTaskMutations();

  const name = user?.displayName?.split(" ")[0] ?? user?.email ?? "";

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <Avatar name={user?.displayName ?? user?.email ?? "?"} size={40} round dark />
          <View style={styles.headerText}>
            <Text style={styles.headerDate}>{formatDate(new Date(), { weekday: "long", day: "numeric", month: "long" })}</Text>
            <Text style={styles.headerGreeting} numberOfLines={1}>
              {t(greetingKey(new Date().getHours()), { name })}
            </Text>
          </View>
          <Pressable onPress={() => router.push("/notifications")} style={styles.bell} hitSlop={6}>
            <Icon name="notifications" size={21} color={colors.brandCream} />
            {unread > 0 ? <View style={styles.bellDot} /> : null}
          </Pressable>
        </View>

        {data ? (
          <View style={styles.statsRow}>
            <StatTile value={data.kpis.hearingsNext7} label={t("hearingsThisWeek")} />
            <StatTile
              value={data.urgentDeadlines.length}
              label={t("deadlinesIn72h")}
              accent={data.urgentDeadlines.length > 0}
            />
            <StatTile value={data.myTasks.length} label={t("openTasks")} />
          </View>
        ) : null}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandDark} />
        </View>
      ) : isError || !data ? (
        <View style={styles.center}>
          <EmptyState icon="today" title={t("common:state.error", { ns: "common" })} />
          <Pressable onPress={() => refetch()}>
            <Text style={styles.retry}>{t("common:actions.retry", { ns: "common" })}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {data.upcomingHearings[0] ? (
            <View>
              <SectionHeader label={t("nextHearing")} withRule />
              <NextHearingCard hearing={data.upcomingHearings[0]} />
            </View>
          ) : null}

          {data.urgentDeadlines.length > 0 ? (
            <View>
              <SectionHeader label={t("urgentDeadlines")} withRule />
              <Card radius="lgXl" padded={false}>
                {data.urgentDeadlines.map((d, i) => (
                  <DeadlineRow key={d.id} deadline={d} isLast={i === data.urgentDeadlines.length - 1} />
                ))}
              </Card>
            </View>
          ) : null}

          {data.myTasks.length > 0 ? (
            <View>
              <Pressable onPress={() => router.push("/tasks")}>
                <SectionHeader label={t("myTasksToday")} withRule />
              </Pressable>
              <Card radius="lgXl" padded={false}>
                {data.myTasks.map((task, i) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    isLast={i === data.myTasks.length - 1}
                    onToggle={() => complete.mutate(task.id)}
                  />
                ))}
              </Card>
            </View>
          ) : null}
        </ScrollView>
      )}

      <FAB />
    </View>
  );
}

function StatTile({ value, label, accent = false }: { value: number; label: string; accent?: boolean }) {
  return (
    <View style={styles.statTile}>
      <Text style={[styles.statValue, accent && { color: "#E8B49A" }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function NextHearingCard({ hearing }: { hearing: DashboardHearing }) {
  const date = new Date(hearing.scheduledAt);
  const month = date.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const { t } = useTranslation("dashboard");
  return (
    <Pressable onPress={() => router.push(`/hearings/${hearing.id}`)}>
      <Card radius="xl">
        <View style={styles.hearingTop}>
          <View style={styles.dateChip}>
            <Text style={styles.dateChipMonth}>{month}</Text>
            <Text style={styles.dateChipDay}>{date.getDate()}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.hearingTitle} numberOfLines={2}>
              {hearing.matterTitle}
            </Text>
            <Text style={styles.hearingCourt} numberOfLines={1}>
              {hearing.court}
            </Text>
          </View>
        </View>
        <View style={styles.hearingDivider}>
          <MatterRefBadge reference={hearing.matterNumber} />
          <Text style={styles.hearingTime}>{formatTime(hearing.scheduledAt)}</Text>
          <Pressable
            style={styles.directionsPill}
            onPress={() =>
              Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hearing.court)}`)
            }
          >
            <Icon name="directions" size={16} color={colors.textOnDark} />
            <Text style={styles.directionsText}>{t("directions")}</Text>
          </Pressable>
        </View>
      </Card>
    </Pressable>
  );
}

function DeadlineRow({ deadline, isLast }: { deadline: DashboardDeadline; isLast: boolean }) {
  const { t } = useTranslation("dashboard");
  const dueDays = Math.max(0, Math.ceil((new Date(deadline.dueAt).getTime() - Date.now()) / 86_400_000));
  return (
    <Pressable
      onPress={() => router.push(`/case/${deadline.matterId}`)}
      style={[styles.deadlineRow, !isLast && styles.rowBorder]}
    >
      <View style={[styles.accentBar, { backgroundColor: deadline.severity === "critical" ? colors.dangerAccent : colors.warningAccent }]} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {deadline.title}
        </Text>
        <Text style={styles.rowSubtitle} numberOfLines={1}>
          {deadline.matterTitle} · {deadline.matterNumber}
        </Text>
      </View>
      <StatusBadge label={t("dueIn", { count: dueDays })} tone={deadline.severity === "critical" ? "danger" : "warning"} />
    </Pressable>
  );
}

function TaskRow({ task, isLast, onToggle }: { task: DashboardTask; isLast: boolean; onToggle: () => void }) {
  return (
    <View style={[styles.taskRow, !isLast && styles.rowBorder]}>
      <Pressable onPress={onToggle} style={styles.checkbox} hitSlop={6} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {task.title}
        </Text>
        {task.matterTitle || task.dueAt ? (
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {[task.matterTitle, task.dueAt ? formatDate(task.dueAt) : null].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
      </View>
      {task.priority !== "low" ? (
        <StatusBadge label={task.priority === "high" ? "High" : "Normal"} tone={task.priority === "high" ? "danger" : "neutral"} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    backgroundColor: colors.brandDark,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: radii.xxl,
    borderBottomRightRadius: radii.xxl,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerText: { flex: 1, minWidth: 0 },
  headerDate: { fontFamily: fontFamily.semibold, fontSize: fontSize.base, color: colors.brandTan },
  headerGreeting: { fontFamily: fontFamily.extrabold, fontSize: fontSize.xxl, color: colors.textOnDark, letterSpacing: -0.3 },
  bell: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.brandDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  bellDot: {
    position: "absolute",
    top: 9,
    end: 10,
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: "#E8836B",
    borderWidth: 1.5,
    borderColor: colors.brandDark,
  },
  statsRow: { flexDirection: "row", gap: 10, marginTop: 18 },
  statTile: { flex: 1, backgroundColor: colors.brandDeep, borderRadius: radii.lg, padding: 13 },
  statValue: { fontFamily: fontFamily.extrabold, fontSize: fontSize.displayMd, color: colors.textOnDark },
  statLabel: { fontFamily: fontFamily.semibold, fontSize: fontSize.sm, color: colors.brandTan, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  retry: { fontFamily: fontFamily.bold, color: colors.brandBronzeLabel },
  content: { padding: 20, gap: 18, paddingBottom: 100 },
  hearingTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  dateChip: { backgroundColor: colors.brandCream, borderRadius: radii.lg, paddingHorizontal: 12, paddingVertical: 9, alignItems: "center" },
  dateChipMonth: { fontFamily: fontFamily.extrabold, fontSize: fontSize.xs, color: colors.brandBronzeLabel, letterSpacing: 0.5 },
  dateChipDay: { fontFamily: fontFamily.extrabold, fontSize: fontSize.displayMd, color: colors.brandDark, lineHeight: 21 },
  hearingTitle: { fontFamily: fontFamily.extrabold, fontSize: fontSize.lgMd, lineHeight: 19, color: colors.textPrimary },
  hearingCourt: { fontFamily: fontFamily.medium, fontSize: fontSize.base, color: colors.textSecondary, marginTop: 4 },
  hearingDivider: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14, paddingTop: 13, borderTopWidth: 1, borderTopColor: colors.borderHairline },
  hearingTime: { fontFamily: fontFamily.bold, fontSize: fontSize.baseMd, color: colors.brandDark },
  directionsPill: { marginStart: "auto", flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, paddingVertical: 5, borderRadius: radii.pill, backgroundColor: colors.brandDark },
  directionsText: { fontFamily: fontFamily.bold, fontSize: fontSize.base, color: colors.textOnDark },
  deadlineRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13, paddingHorizontal: 15 },
  taskRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, paddingHorizontal: 15 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderHairline },
  accentBar: { width: 3, alignSelf: "stretch", borderRadius: radii.pill },
  checkbox: { width: 22, height: 22, borderWidth: 2, borderColor: colors.borderNeutral, borderRadius: radii.xs },
  rowTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.textPrimary },
  rowSubtitle: { fontFamily: fontFamily.medium, fontSize: fontSize.smMd, color: colors.textSecondary, marginTop: 2 },
});
