import { useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth/use-auth";
import { formatDate } from "@/lib/format";
import { colors, radii } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/Button";
import { SearchBar } from "@/components/ui/SearchBar";
import { Chip } from "@/components/ui/Chip";
import { Card } from "@/components/ui/Card";
import { MatterRefBadge } from "@/components/ui/MatterRefBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { FAB } from "@/components/ui/FAB";
import { notAvailableYet } from "@/lib/not-available";
import { useRefresh } from "@/lib/use-refresh";
import { useMatterList } from "../hooks";
import { matterDisplayStatus, MATTER_STATUS_LABEL, MATTER_STATUS_TONE } from "../presentation";
import type { MatterListItem } from "../types";

type Filter = "mine" | "active" | "hearingSet" | "onHold";

export default function CasesScreen() {
  const { t } = useTranslation("matters");
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("mine");
  const { data, isLoading, refetch } = useMatterList({ q: query || undefined, status: "all", sort: "-openedAt" });
  const { refreshing, onRefresh } = useRefresh(refetch);

  const items = useMemo(() => {
    const all = data?.items ?? [];
    if (filter === "mine") {
      const me = (user?.displayName ?? "").trim();
      return me ? all.filter((m) => m.leadLawyer === me) : all;
    }
    return all.filter((m) => {
      const status = matterDisplayStatus(m);
      if (filter === "active") return status === "active";
      if (filter === "hearingSet") return status === "hearingSet";
      if (filter === "onHold") return status === "onHold";
      return true;
    });
  }, [data, filter, user]);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t("title")}</Text>
          <Text style={styles.count}>{data?.summary.total ?? ""}</Text>
          <IconButton icon="add" onPress={() => notAvailableYet(t("title"))} />
        </View>
        <View style={{ marginTop: 13 }}>
          <SearchBar placeholder={t("searchPlaceholder")} value={query} onChangeText={setQuery} />
        </View>
        <View style={styles.chips}>
          <Chip label={t("filters.mine")} active={filter === "mine"} onPress={() => setFilter("mine")} />
          <Chip label={t("filters.active")} active={filter === "active"} onPress={() => setFilter("active")} />
          <Chip label={t("filters.hearingSet")} active={filter === "hearingSet"} onPress={() => setFilter("hearingSet")} />
          <Chip label={t("filters.onHold")} active={filter === "onHold"} onPress={() => setFilter("onHold")} />
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandDark} />
        </View>
      ) : items.length === 0 ? (
        <EmptyState icon="gavel" title={t("empty")} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <MatterCard matter={item} />}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandDark} />}
        />
      )}
      <FAB />
    </View>
  );
}

function MatterCard({ matter }: { matter: MatterListItem }) {
  const { t } = useTranslation("matters");
  const status = matterDisplayStatus(matter);
  return (
    <Pressable onPress={() => router.push(`/case/${matter.id}`)}>
      <Card radius="xl">
        <View style={styles.cardTop}>
          <MatterRefBadge reference={matter.reference} />
          <StatusBadge label={MATTER_STATUS_LABEL[status]} tone={MATTER_STATUS_TONE[status]} />
          <Text style={styles.practiceArea} numberOfLines={1}>
            {matter.practiceArea}
          </Text>
        </View>
        <Text style={styles.matterTitle} numberOfLines={2}>
          {matter.title}
        </Text>
        <Text style={styles.matterCourt} numberOfLines={1}>
          {matter.clientName}
          {matter.court ? ` · ${matter.court}` : ""}
        </Text>
        <View style={styles.cardDivider}>
          <Icon
            name={status === "onHold" ? "alarm" : "event"}
            size={17}
            color={status === "onHold" ? colors.dangerAccent : colors.brandBronze}
          />
          <Text style={[styles.cardFooterText, status === "onHold" && { color: colors.dangerText }]} numberOfLines={1}>
            {matter.nextHearingAt ? t("nextHearing", { date: formatDate(matter.nextHearingAt, { day: "numeric", month: "short" }) }) : matter.status}
          </Text>
          <Text style={styles.leadLawyer} numberOfLines={1}>
            {matter.leadLawyer}
          </Text>
        </View>
      </Card>
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
  count: { fontFamily: fontFamily.bold, fontSize: fontSize.baseMd, color: colors.textSecondary },
  chips: { flexDirection: "row", gap: 8, marginTop: 13 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 20, gap: 12, paddingBottom: 100 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 9 },
  practiceArea: { marginStart: "auto", fontFamily: fontFamily.bold, fontSize: fontSize.sm, color: colors.textSecondary },
  matterTitle: { fontFamily: fontFamily.extrabold, fontSize: fontSize.lgMd, lineHeight: 19, marginTop: 10, color: colors.textPrimary },
  matterCourt: { fontFamily: fontFamily.medium, fontSize: fontSize.base, color: colors.textSecondary, marginTop: 4 },
  cardDivider: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 13, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.borderHairline },
  cardFooterText: { fontFamily: fontFamily.bold, fontSize: fontSize.baseMd, color: colors.textPrimary },
  leadLawyer: { marginStart: "auto", fontFamily: fontFamily.semibold, fontSize: fontSize.smMd, color: colors.textSecondary },
});
