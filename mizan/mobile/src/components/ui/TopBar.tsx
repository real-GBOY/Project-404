import type { ReactNode } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";
import { Icon, type IconName } from "./Icon";
import { useDir } from "@/lib/i18n/use-dir";

export interface TopBarAction {
  icon: IconName;
  onPress?: () => void;
  color?: string;
}

/**
 * The bar-style header used by Notifications, Hearing, Log Time, Expense,
 * Finance, Client Profile, Ask Mizan, etc.: leading back/close, a title, and
 * up to a couple of trailing icon actions. `dark` matches the brown header
 * variant (Case Detail, Today).
 */
export function TopBar({
  title,
  onBack,
  onClose,
  actions = [],
  trailing,
  dark = false,
  large = false,
  children,
}: {
  title?: string;
  onBack?: () => void;
  onClose?: () => void;
  actions?: TopBarAction[];
  /** non-icon trailing content (e.g. a "Mark all read" text link), rendered
   *  in the same row after the title/icon actions. */
  trailing?: ReactNode;
  dark?: boolean;
  /** the design's 19px title weight used on a couple of bar headers
   *  (Notifications, Finance) vs. the more common 17px. */
  large?: boolean;
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { isRtl } = useDir();
  const fg = dark ? colors.textOnDark : colors.brandDark;

  return (
    <View
      style={[
        styles.wrap,
        { paddingTop: insets.top + 10 },
        dark ? styles.dark : styles.light,
      ]}
    >
      <View style={styles.row}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
            <Icon
              name="arrow_back"
              size={24}
              color={fg}
              style={isRtl ? { transform: [{ scaleX: -1 }] } : undefined}
            />
          </Pressable>
        ) : null}
        {onClose ? (
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
            <Icon name="close" size={24} color={fg} />
          </Pressable>
        ) : null}
        {title ? (
          <Text
            style={[
              large ? styles.titleLarge : styles.title,
              { color: fg },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        {actions.map((a, i) => (
          <Pressable key={i} onPress={a.onPress} hitSlop={10} accessibilityRole="button">
            <Icon name={a.icon} size={23} color={a.color ?? fg} />
          </Pressable>
        ))}
        {trailing}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  light: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dark: {
    backgroundColor: colors.brandDark,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  title: {
    flex: 1,
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xxl,
    letterSpacing: -0.3,
  },
  titleLarge: {
    flex: 1,
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.display,
    letterSpacing: -0.3,
  },
});
