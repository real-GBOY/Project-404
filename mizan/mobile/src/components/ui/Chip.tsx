import { Pressable, Text, StyleSheet } from "react-native";
import { colors, radii } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";

/** The filter-pill pattern used on Notifications/Cases/Tasks/Files headers. */
export function Chip({
  label,
  active = false,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.base, active ? styles.active : styles.inactive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.label, active ? styles.labelActive : styles.labelInactive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: radii.smMd,
    borderWidth: 1,
  },
  active: {
    backgroundColor: colors.brandDark,
    borderColor: colors.brandDark,
  },
  inactive: {
    backgroundColor: "transparent",
    borderColor: colors.borderNeutral,
  },
  label: {
    fontSize: fontSize.base,
    letterSpacing: 0.2,
  },
  labelActive: {
    fontFamily: fontFamily.semibold,
    color: colors.textOnDark,
  },
  labelInactive: {
    fontFamily: fontFamily.medium,
    color: colors.textSecondary,
  },
});
