import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { formatFileSize } from "@/lib/format";
import { colors } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";
import { TopBar } from "@/components/ui/TopBar";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { MatterRefBadge } from "@/components/ui/MatterRefBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useOfflineDocuments, useOfflineStorageUsed, useOfflinePinning } from "../hooks";

export default function OfflineDocumentsScreen() {
  const { t } = useTranslation("settings");
  const { data } = useOfflineDocuments();
  const used = useOfflineStorageUsed();
  const { unpin } = useOfflinePinning();
  const entries = data ?? [];

  return (
    <View style={styles.screen}>
      <TopBar title={t("offlineDocuments")} onBack={() => router.back()} />
      {entries.length === 0 ? (
        <EmptyState icon="offline_pin" title={t("common:state.empty", { ns: "common" })} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.id}
          ListHeaderComponent={<Text style={styles.total}>{formatFileSize(used.data ?? 0)}</Text>}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <Card radius="lgXl" padded={false}>
              <View style={styles.row}>
                <Icon name="description" size={22} color={colors.iconMuted} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={styles.meta}>
                    {item.matterReference ? <MatterRefBadge reference={item.matterReference} small /> : null}
                    <Text style={styles.size}>{formatFileSize(item.sizeBytes)}</Text>
                  </View>
                </View>
                <Pressable onPress={() => unpin.mutate(item.id)} hitSlop={8}>
                  <Icon name="offline_pin" size={20} color={colors.brandBronze} />
                </Pressable>
              </View>
            </Card>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { padding: 20 },
  total: { fontFamily: fontFamily.extrabold, fontSize: fontSize.displayMd, color: colors.textPrimary, marginBottom: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 15 },
  name: { fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.textPrimary },
  meta: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 5 },
  size: { fontFamily: fontFamily.semibold, fontSize: fontSize.sm, color: colors.textSecondary },
});
