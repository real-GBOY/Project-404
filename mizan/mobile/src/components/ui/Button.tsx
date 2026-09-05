import { Pressable, Text, View, ActivityIndicator, StyleSheet, type ViewStyle } from "react-native";
import { colors, radii } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";
import { Icon, type IconName } from "./Icon";

interface BaseProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  style?: ViewStyle;
  fullWidth?: boolean;
}

/** The solid dark-brown CTA (Sign in, Save time entry, Confirm & submit, …). */
export function PrimaryButton({ label, onPress, disabled, loading, icon, style, fullWidth = true }: BaseProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        styles.primary,
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color={colors.textOnDark} />
      ) : (
        <View style={styles.content}>
          {icon ? <Icon name={icon} size={19} color={colors.textOnDark} /> : null}
          <Text style={styles.primaryLabel}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** The bronze accent CTA used on dark screens (sign-in, hearing check-in). */
export function BronzeButton({ label, onPress, disabled, loading, icon, style, fullWidth = true }: BaseProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        styles.bronze,
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color={colors.brandBronzeText} />
      ) : (
        <View style={styles.content}>
          {icon ? <Icon name={icon} size={20} color={colors.brandBronzeText} /> : null}
          <Text style={styles.bronzeLabel}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** The outlined secondary button (Cancel, Email, …). */
export function SecondaryButton({ label, onPress, disabled, loading, icon, style, fullWidth = true }: BaseProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        styles.secondary,
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && styles.pressedLight,
        style,
      ]}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color={colors.brandDark} />
      ) : (
        <View style={styles.content}>
          {icon ? <Icon name={icon} size={19} color={colors.brandDark} /> : null}
          <Text style={styles.secondaryLabel}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** A square icon-only affordance (header actions, add buttons). */
export function IconButton({
  icon,
  onPress,
  size = 38,
  variant = "dark",
  iconSize = 20,
}: {
  icon: IconName;
  onPress?: () => void;
  size?: number;
  variant?: "dark" | "outline" | "plain";
  iconSize?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: radii.md,
          alignItems: "center",
          justifyContent: "center",
        },
        variant === "dark" && { backgroundColor: colors.brandDark },
        variant === "outline" && { borderWidth: 1, borderColor: colors.borderNeutral },
        pressed && { opacity: 0.75 },
      ]}
      accessibilityRole="button"
    >
      <Icon
        name={icon}
        size={iconSize}
        color={variant === "dark" ? colors.textOnDark : colors.brandDark}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  fullWidth: {
    alignSelf: "stretch",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primary: {
    backgroundColor: colors.brandDark,
  },
  primaryLabel: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xl,
    color: colors.textOnDark,
  },
  bronze: {
    backgroundColor: colors.brandBronze,
  },
  bronzeLabel: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xl,
    color: colors.brandBronzeText,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderNeutral,
  },
  secondaryLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.brandDark,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.9,
  },
  pressedLight: {
    backgroundColor: colors.bgSunk,
  },
});
