import { View, Text, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { formatDateTime } from "@/lib/format";
import { colors } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";
import { TopBar } from "@/components/ui/TopBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuditLogs } from "../hooks";

export default function AuditLogScreen() {
  const { t } = useTranslation("settings");
  const { data, isLoading } = useAuditLogs("");

  return (
    <View style={styles.screen}>
      <TopBar title={t("auditLog")} onBack={() => router.back()} />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandDark} />
        </View>
      ) : (data?.items ?? []).length === 0 ? (
        <EmptyState icon="shield" title={t("common:state.empty", { ns: "common" })} />
      ) : (
        <FlatList
          data={data!.items}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.action}>
                {item.action} · {item.resource}
              </Text>
              <Text style={styles.meta}>
                {item.actor} · {formatDateTime(item.at)}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 20, gap: 1 },
  row: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderHairline,
    paddingHorizontal: 15,
    paddingVertical: 14,
  },
  action: { fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.textPrimary },
  meta: { fontFamily: fontFamily.medium, fontSize: fontSize.base, color: colors.textSecondary, marginTop: 3 },
});
