import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, em } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import { Icon, type IconName } from "./Icon";

type Variant = "lime" | "ink" | "outline";

type Props = {
  label: string;
  onPress: () => void;
  icon?: IconName | null;
  iconPosition?: "left" | "right";
  variant?: Variant;
  height?: number;
  fontSize?: number;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
};

/** Full-width Bebas CTA — lime (primary), ink (LOG SET) or lime-outline (SHARE PR). */
export function LimeButton({
  label,
  onPress,
  icon = "arrowRight",
  iconPosition = "right",
  variant = "lime",
  height = 56,
  fontSize = 22,
  style,
  disabled,
}: Props) {
  const fg = variant === "ink" ? colors.lime : variant === "outline" ? colors.lime : colors.ink;
  const glyph = icon ? <Icon name={icon} size={18} color={fg} /> : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        { height },
        variant === "lime" && styles.lime,
        variant === "ink" && { backgroundColor: colors.ink },
        variant === "outline" && { borderWidth: 1, borderColor: colors.lime },
        disabled && { opacity: 0.5 },
        pressed && { transform: [{ scale: 0.985 }], opacity: 0.93 },
        style,
      ]}
    >
      {iconPosition === "left" ? glyph : null}
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize,
          color: fg,
          letterSpacing: em(fontSize, 0.12),
        }}
      >
        {label}
      </Text>
      {iconPosition === "right" ? glyph : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: "100%",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  lime: {
    backgroundColor: colors.lime,
    shadowColor: colors.lime,
    shadowOpacity: 0.3,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
});
