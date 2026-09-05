import type { ReactNode } from "react";
import { Pressable, View, Text, StyleSheet, type ViewStyle } from "react-native";
import { colors } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";
import { Icon, type IconName } from "./Icon";
import { useDir } from "@/lib/i18n/use-dir";

export interface ListRowProps {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** default trailing affordance matching the design's list rows */
  chevron?: boolean;
  trailingIcon?: IconName;
  onPress?: () => void;
  onTrailingPress?: () => void;
  bordered?: boolean;
  style?: ViewStyle;
}

/** The icon-or-avatar + title/subtitle + trailing-chevron row used
 *  throughout every list screen in the design. */
export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  chevron = false,
  trailingIcon,
  onPress,
  onTrailingPress,
  bordered = true,
  style,
}: ListRowProps) {
  const { isRtl } = useDir();
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      onPress={onPress}
      style={[styles.row, bordered && styles.border, style]}
      accessibilityRole={onPress ? "button" : undefined}
    >
      {leading}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {trailingIcon ? (
        <Pressable onPress={onTrailingPress} hitSlop={8}>
          <Icon name={trailingIcon} size={21} color={colors.brandBronze} />
        </Pressable>
      ) : null}
      {chevron ? (
        <Icon
          name="chevron_right"
          size={20}
          color={colors.chevronMuted}
          style={isRtl ? { transform: [{ scaleX: -1 }] } : undefined}
        />
      ) : null}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 15,
    paddingVertical: 13,
  },
  border: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderHairline,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.smMd,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
