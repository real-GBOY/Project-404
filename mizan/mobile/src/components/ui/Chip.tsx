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
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.pill,
  },
  active: {
    backgroundColor: colors.brandDark,
  },
  inactive: {
    backgroundColor: colors.chipInactiveBg,
  },
  label: {
    fontSize: fontSize.baseMd,
  },
  labelActive: {
    fontFamily: fontFamily.bold,
    color: colors.textOnDark,
  },
  labelInactive: {
    fontFamily: fontFamily.semibold,
    color: colors.chipInactiveText,
  },
});
