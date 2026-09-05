import { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth/use-auth";
import { formatDate } from "@/lib/format";
import { colors, radii } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";
import { IconButton } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { MatterRefBadge } from "@/components/ui/MatterRefBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { notAvailableYet } from "@/lib/not-available";
import { useTaskList, useTaskMutations } from "../hooks";
import type { TaskRow } from "../types";

type Filter = "assignedToMe" | "delegated" | "done";

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

function bucket(task: TaskRow): "overdue" | "today" | "thisWeek" | "upcoming" {
  if (task.overdue) return "overdue";
  if (!task.dueAt) return "upcoming";
  const due = startOfDay(new Date(task.dueAt));
  const today = startOfDay(new Date());
  if (due <= today) return "today";
  if (due <= today + 7 * 86_400_000) return "thisWeek";
  return "upcoming";
}

export default function TasksScreen() {
  const { t } = useTranslation("tasks");
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>("assignedToMe");

  const mineList = useTaskList({ mine: filter === "assignedToMe", status: filter === "done" ? "done" : "all" });
  const { complete } = useTaskMutations();

  const groups = useMemo(() => {
    let items = mineList.data?.items ?? [];
    if (filter === "delegated") {
      const me = user?.id;
      items = items.filter((tk) => tk.assigneeId && tk.assigneeId !== me);
    }
    if (filter === "done") return { done: items } as Record<string, TaskRow[]>;
    const g: Record<string, TaskRow[]> = { overdue: [], today: [], thisWeek: [], upcoming: [] };
    for (const tk of items) if (tk.status !== "done") g[bucket(tk)].push(tk);
    return g;
  }, [mineList.data, filter, user]);

  const order = filter === "done" ? ["done"] : ["overdue", "today", "thisWeek", "upcoming"];
  const labelFor: Record<string, (n: number) => string> = {
    overdue: (n) => t("overdue", { count: n }),
    today: (n) => t("today", { count: n }),
    thisWeek: (n) => t("thisWeek", { count: n }),
    upcoming: (n) => `${t("common:time.tomorrow", { ns: "common" })} +`,
    done: (n) => t("filters.done"),
  };
  const nonEmpty = order.filter((k) => (groups[k] ?? []).length > 0);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t("title")}</Text>
          <IconButton icon="add" onPress={() => notAvailableYet(t("title"))} />
        </View>
        <View style={styles.chips}>
          <Chip label={t("filters.assignedToMe")} active={filter === "assignedToMe"} onPress={() => setFilter("assignedToMe")} />
          <Chip label={t("filters.delegated")} active={filter === "delegated"} onPress={() => setFilter("delegated")} />
          <Chip label={t("filters.done")} active={filter === "done"} onPress={() => setFilter("done")} />
        </View>
      </View>

      {mineList.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandDark} />
        </View>
      ) : nonEmpty.length === 0 ? (
        <EmptyState icon="task_alt" title={t("empty")} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {nonEmpty.map((key) => (
            <View key={key}>
              <SectionHeader label={labelFor[key](groups[key].length)} withRule tone={key === "overdue" ? "danger" : "default"} />
              <Card radius="lgXl" padded={false}>
                {groups[key].map((tk, i) => (
                  <TaskItem
                    key={tk.id}
                    task={tk}
                    isLast={i === groups[key].length - 1}
                    onToggle={() => complete.mutate(tk.id)}
                  />
                ))}
              </Card>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function TaskItem({ task, isLast, onToggle }: { task: TaskRow; isLast: boolean; onToggle: () => void }) {
  return (
    <Pressable
      style={[styles.row, !isLast && styles.rowBorder]}
      onPress={() => task.matterId && router.push(`/case/${task.matterId}`)}
    >
      <Pressable onPress={onToggle} hitSlop={6} style={[styles.checkbox, task.status === "done" && styles.checkboxDone]} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.taskTitle, task.status === "done" && styles.strike]}>{task.title}</Text>
        <View style={styles.metaRow}>
          {task.matterReference ? <MatterRefBadge reference={task.matterReference} small /> : null}
          {task.priority === "high" ? (
            <StatusBadge label="High" tone="danger" />
          ) : task.dueAt ? (
            <Text style={[styles.due, task.overdue && styles.dueOverdue]}>
              {formatDate(task.dueAt, { day: "numeric", month: "short" })}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { flex: 1, fontFamily: fontFamily.extrabold, fontSize: fontSize.displayLg, letterSpacing: -0.3, color: colors.textPrimary },
  chips: { flexDirection: "row", gap: 8, marginTop: 13 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 20, gap: 16, paddingBottom: 40 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 15, paddingVertical: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderHairline },
  checkbox: { width: 22, height: 22, borderWidth: 2, borderColor: colors.borderNeutral, borderRadius: radii.xs, marginTop: 1 },
  checkboxDone: { backgroundColor: colors.brandBronze, borderColor: colors.brandBronze },
  taskTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.mdLg, lineHeight: 19, color: colors.textPrimary },
  strike: { textDecorationLine: "line-through", color: colors.textSecondary },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  due: { fontFamily: fontFamily.semibold, fontSize: fontSize.smMd, color: colors.textSecondary },
  dueOverdue: { fontFamily: fontFamily.bold, color: colors.dangerText },
});
