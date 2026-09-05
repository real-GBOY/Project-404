import { View, Text, StyleSheet } from "react-native";
import { colors } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";
import { Icon, type IconName } from "./Icon";

export function EmptyState({
  icon = "folder_open",
  title,
  subtitle,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Icon name={icon} size={26} color={colors.iconMuted} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 32,
    gap: 10,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.bgSunk,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.baseMd,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
