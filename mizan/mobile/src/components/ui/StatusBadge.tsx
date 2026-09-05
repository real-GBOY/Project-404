import { View, Text, StyleSheet } from "react-native";
import { colors, radii } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";

export type StatusTone = "danger" | "warning" | "success" | "info" | "neutral" | "dark";

const TONE: Record<StatusTone, { bg: string; text: string; dot: string }> = {
  danger: { bg: colors.dangerBg, text: colors.dangerText, dot: colors.dangerAccent },
  warning: { bg: colors.warningBg, text: colors.warningText, dot: colors.warningAccent },
  success: { bg: colors.successBg, text: colors.successText, dot: colors.successText },
  info: { bg: colors.infoBg, text: colors.infoText, dot: colors.infoText },
  neutral: { bg: colors.neutralTanBg, text: colors.neutralTanText, dot: colors.neutralTanText },
  dark: { bg: colors.brandDark, text: colors.textOnDark, dot: colors.brandBronze },
};

/** Status label — a tight tinted rectangle (Mizan Identity: no pills). Colour
 *  follows the semantic tone, not the literal text. */
export function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: StatusTone }) {
  const t = TONE[tone];
  return (
    <View style={[styles.base, { backgroundColor: t.bg }]}>
      <Text style={[styles.label, { color: t.text }]}>{label}</Text>
    </View>
  );
}

/** The identity's list-row status marker: a small filled square + nothing
 *  else (the "In use" Today screen). */
export function StatusDot({ tone = "neutral", size = 9 }: { tone?: StatusTone; size?: number }) {
  return <View style={{ width: size, height: size, backgroundColor: TONE[tone].dot }} />;
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.xs,
    alignSelf: "flex-start",
  },
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.smMd,
    letterSpacing: 0.2,
  },
});
