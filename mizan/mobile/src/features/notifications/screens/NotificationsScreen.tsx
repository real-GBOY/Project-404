import { useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { colors, radii } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";
import { TopBar } from "@/components/ui/TopBar";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { formatRelative } from "@/lib/format";
import { useNotifications, useNotificationMutations } from "../hooks";
import { categoryForNotification, iconForNotification, toneForNotification, type NotificationCategory } from "../presentation";
import type { AppNotification } from "../types";

const TONE_BG: Record<string, string> = {
  danger: colors.dangerBg,
  warning: colors.warningBg,
  success: colors.successBg,
  info: colors.infoBg,
  neutral: colors.neutralTanBg,
  dark: colors.brandDark,
};
const TONE_FG: Record<string, string> = {
  danger: colors.dangerText,
  warning: colors.warningText,
  success: colors.successText,
  info: colors.infoText,
  neutral: colors.brandDeep,
  dark: colors.textOnDark,
};

const FILTERS: { key: "all" | NotificationCategory; labelKey: string }[] = [
  { key: "all", labelKey: "filters.all" },
  { key: "hearings", labelKey: "filters.hearings" },
  { key: "deadlines", labelKey: "filters.deadlines" },
  { key: "finance", labelKey: "filters.finance" },
];

/** Best-effort mapping from a backend deep-link `href` (a web route, e.g.
 *  `/matters/:id`) onto this app's own routes. Falls back to doing nothing
 *  rather than guessing a route that doesn't exist. */
function navigateFromHref(href: string) {
  const matterMatch = href.match(/^\/matters\/([^/]+)/);
  if (matterMatch) return router.push(`/case/${matterMatch[1]}`);
  const clientMatch = href.match(/^\/clients\/([^/]+)/);
  if (clientMatch) return router.push(`/clients/${clientMatch[1]}`);
}

export default function NotificationsScreen() {
  const { t } = useTranslation("notifications");
  const [filter, setFilter] = useState<"all" | NotificationCategory>("all");
  const { data, isLoading, isError } = useNotifications({});
  const { markRead, markAllRead } = useNotificationMutations();

  const items = useMemo(() => {
    const all = data?.items ?? [];
    if (filter === "all") return all;
    return all.filter((n) => categoryForNotification(n.type) === filter);
  }, [data, filter]);

  const renderItem = ({ item }: { item: AppNotification }) => {
    const tone = toneForNotification(item.type);
    const unread = !item.readAt;
    return (
      <Pressable
        style={[styles.row, !unread && styles.rowRead]}
        onPress={() => {
          if (unread) markRead.mutate(item.id);
          if (item.href) navigateFromHref(item.href);
        }}
      >
        <View style={[styles.iconChip, { backgroundColor: TONE_BG[tone] }]}>
          <Icon name={iconForNotification(item.type)} size={19} color={TONE_FG[tone]} />
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>
            {unread ? <View style={styles.dot} /> : null}
          </View>
          {item.body ? (
            <Text style={styles.desc} numberOfLines={3}>
              {item.body}
            </Text>
          ) : null}
          <Text style={styles.time}>{formatRelative(item.createdAt)}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <TopBar
        title={t("title")}
        onBack={() => router.back()}
        large
        trailing={
          <Pressable onPress={() => markAllRead.mutate()} hitSlop={8}>
            <Text style={styles.markAllText}>{t("markAllRead")}</Text>
          </Pressable>
        }
      >
        <View style={styles.chips}>
          {FILTERS.map((f) => (
            <Chip key={f.key} label={t(f.labelKey)} active={filter === f.key} onPress={() => setFilter(f.key)} />
          ))}
        </View>
      </TopBar>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandDark} />
        </View>
      ) : isError ? (
        <EmptyState icon="notifications" title={t("common:state.error", { ns: "common" })} />
      ) : items.length === 0 ? (
        <EmptyState icon="notifications" title={t("empty")} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  markAllText: { fontFamily: fontFamily.bold, fontSize: fontSize.baseMd, color: colors.brandBronzeLabel },
  chips: { flexDirection: "row", gap: 8, marginTop: 14 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 20, gap: 11 },
  row: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lgXl,
    padding: 14,
    flexDirection: "row",
    gap: 12,
  },
  rowRead: { opacity: 0.78 },
  iconChip: {
    width: 36,
    height: 36,
    borderRadius: radii.smMd,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1, fontFamily: fontFamily.extrabold, fontSize: fontSize.mdLg, color: colors.textPrimary },
  dot: { width: 7, height: 7, borderRadius: radii.pill, backgroundColor: colors.brandBronze },
  desc: { fontFamily: fontFamily.medium, fontSize: fontSize.baseMd, color: colors.textSecondary, lineHeight: 18, marginTop: 3 },
  time: { fontFamily: fontFamily.semibold, fontSize: fontSize.base, color: colors.textSecondary, marginTop: 7 },
});
