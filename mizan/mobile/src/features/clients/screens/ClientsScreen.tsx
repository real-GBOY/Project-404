import { useMemo, useState } from "react";
import { View, Text, SectionList, Pressable, ActivityIndicator, StyleSheet, Linking } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";
import { IconButton } from "@/components/ui/Button";
import { SearchBar } from "@/components/ui/SearchBar";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { FAB } from "@/components/ui/FAB";
import { notAvailableYet } from "@/lib/not-available";
import { useClientList } from "../hooks";
import type { ClientListItem } from "../types";

export default function ClientsScreen() {
  const { t } = useTranslation("clients");
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const { data, isLoading } = useClientList({ q: query || undefined, status: "active", sort: "name" });

  const sections = useMemo(() => {
    const items = [...(data?.items ?? [])].sort((a, b) => a.name.localeCompare(b.name));
    const map = new Map<string, ClientListItem[]>();
    for (const c of items) {
      const letter = (c.name[0] ?? "#").toUpperCase();
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter)!.push(c);
    }
    return [...map.entries()].map(([title, list]) => ({ title, data: list }));
  }, [data]);

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
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandDark} />
        </View>
      ) : sections.length === 0 ? (
        <EmptyState icon="groups" title={t("common:state.empty", { ns: "common" })} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
          renderItem={({ item, index, section }) => (
            <View
              style={[
                styles.rowWrap,
                index === 0 && styles.rowFirst,
                index === section.data.length - 1 && styles.rowLast,
              ]}
            >
              <Pressable
                style={[styles.row, index < section.data.length - 1 && styles.rowBorder]}
                onPress={() => router.push(`/clients/${item.id}`)}
              >
                <Avatar name={item.name} size={38} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {t("openOfTotal", { open: item.openMatters, total: item.totalMatters })} ·{" "}
                    {item.city ?? (item.type === "company" ? "Corporate" : "Individual")}
                  </Text>
                </View>
                {item.phone ? (
                  <Pressable onPress={() => Linking.openURL(`tel:${item.phone}`)} hitSlop={8}>
                    <Icon name="call" size={21} color={colors.brandBronze} />
                  </Pressable>
                ) : null}
              </Pressable>
            </View>
          )}
        />
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
    paddingBottom: 14,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { flex: 1, fontFamily: fontFamily.extrabold, fontSize: fontSize.displayLg, letterSpacing: -0.3, color: colors.textPrimary },
  count: { fontFamily: fontFamily.bold, fontSize: fontSize.baseMd, color: colors.textSecondary },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 20, paddingBottom: 100 },
  sectionHeader: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.sm,
    letterSpacing: 0.9,
    color: colors.textSecondary,
    marginBottom: 9,
    marginTop: 14,
  },
  rowWrap: { backgroundColor: colors.surface, borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border },
  rowFirst: { borderTopWidth: 1, borderTopLeftRadius: radii.lgXl, borderTopRightRadius: radii.lgXl },
  rowLast: { borderBottomWidth: 1, borderBottomLeftRadius: radii.lgXl, borderBottomRightRadius: radii.lgXl },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 15, paddingVertical: 13 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderHairline },
  name: { fontFamily: fontFamily.bold, fontSize: fontSize.mdLg, color: colors.textPrimary },
  sub: { fontFamily: fontFamily.semibold, fontSize: fontSize.smMd, color: colors.textSecondary, marginTop: 2 },
});
