import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { colors, em } from "@/theme/tokens";
import { fonts } from "@/theme/typography";

/** Hero number in Bebas Neue. */
export function Num({
  children,
  size = 32,
  color = colors.ink,
  style,
}: {
  children: ReactNode;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      style={[
        {
          fontFamily: fonts.display,
          fontSize: size,
          lineHeight: Math.round(size * 1.05),
          letterSpacing: em(size, 0.01),
          color,
          includeFontPadding: false,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** Small uppercase label in Space Grotesk. */
export function Label({
  children,
  size = 11,
  color = colors.sub,
  weight = "medium",
  style,
}: {
  children: ReactNode;
  size?: number;
  color?: string;
  weight?: "medium" | "semi";
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      style={[
        {
          fontFamily: weight === "semi" ? fonts.bodySemi : fonts.bodyMedium,
          fontSize: size,
          letterSpacing: em(size, 0.08),
          textTransform: "uppercase",
          color,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Card({
  children,
  dark = false,
  style,
  onPress,
}: {
  children: ReactNode;
  dark?: boolean;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const base = [dark ? styles.cardDark : styles.card, style];
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && styles.pressed]}>
        {children}
      </Pressable>
    );
  }
  return <View style={base}>{children}</View>;
}

/** Circular progress ring. */
export function Ring({
  value,
  total,
  size = 56,
  stroke = 5,
  track = colors.whiteA14,
  color = colors.lime,
  children,
}: {
  value: number;
  total: number;
  size?: number;
  stroke?: number;
  track?: string;
  color?: string;
  children?: ReactNode;
}) {
  const rad = (size - stroke) / 2;
  const circ = 2 * Math.PI * rad;
  const pct = total ? Math.min(1, Math.max(0, value / total)) : 0;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={rad}
          fill="none"
          stroke={track}
          strokeWidth={stroke}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={rad}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
        />
      </Svg>
      <View style={styles.ringCenter}>{children}</View>
    </View>
  );
}

/** Thin progress bar. */
export function Bar({
  pct,
  color = colors.lime,
  track = colors.hair,
  height = 4,
}: {
  pct: number;
  color?: string;
  track?: string;
  height?: number;
}) {
  return (
    <View style={{ height, borderRadius: 99, backgroundColor: track, overflow: "hidden" }}>
      <View
        style={{
          width: `${Math.min(100, Math.max(0, pct * 100))}%`,
          height: "100%",
          borderRadius: 99,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/** Round-cornered icon button used in screen headers (back, filter, gear, bell). */
export function IconButton({
  children,
  onPress,
  label,
  size = 42,
  radius = 13,
  background = colors.card,
  bordered = true,
}: {
  children: ReactNode;
  onPress?: () => void;
  label: string;
  size?: number;
  radius?: number;
  background?: string;
  bordered?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: background,
          alignItems: "center",
          justifyContent: "center",
        },
        bordered && { borderWidth: 1, borderColor: colors.hair },
        pressed && styles.pressed,
      ]}
    >
      {children}
    </Pressable>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Label size={11} color={colors.ink} weight="semi" style={{ paddingLeft: 2 }}>
      {children}
    </Label>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    shadowColor: colors.shadowInk,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardDark: {
    backgroundColor: colors.ink,
    borderRadius: 16,
    shadowColor: colors.black,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  ringCenter: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
});
