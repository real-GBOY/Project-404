import { View, Text, StyleSheet } from "react-native";
import type { ErrorBoundaryProps } from "expo-router";
import { colors } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";
import { Icon } from "@/components/ui/Icon";
import { PrimaryButton } from "@/components/ui/Button";

/** Route-level error boundary UI (wired via `export { ErrorScreen as ErrorBoundary }`). */
export function ErrorScreen({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Icon name="warning" size={28} color={colors.dangerText} />
      </View>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.detail} numberOfLines={4}>
        {error?.message ?? "An unexpected error occurred."}
      </Text>
      <PrimaryButton label="Try again" onPress={retry} fullWidth={false} style={{ marginTop: 20, paddingHorizontal: 28 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: colors.bg, gap: 8 },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.dangerBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  title: { fontFamily: fontFamily.extrabold, fontSize: fontSize.display, color: colors.textPrimary },
  detail: { fontFamily: fontFamily.medium, fontSize: fontSize.md, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
});
