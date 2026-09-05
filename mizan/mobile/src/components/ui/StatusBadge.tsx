import { View, Text, StyleSheet } from "react-native";
import { colors, radii } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";

export type StatusTone = "danger" | "warning" | "success" | "info" | "neutral" | "dark";

const TONE_STYLES: Record<StatusTone, { bg: string; text: string }> = {
  danger: { bg: colors.dangerBg, text: colors.dangerText },
  warning: { bg: colors.warningBg, text: colors.warningText },
  success: { bg: colors.successBg, text: colors.successText },
  info: { bg: colors.infoBg, text: colors.infoText },
  neutral: { bg: colors.neutralTanBg, text: colors.neutralTanText },
  dark: { bg: colors.brandDark, text: colors.textOnDark },
};

/** The status pill pattern — "Active"/"Filing due"/"Hearing set"/"overdue"/
 *  "High"/"Confirmed", etc. Color follows semantic tone, not literal text. */
export function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: StatusTone }) {
  const t = TONE_STYLES[tone];
  return (
    <View style={[styles.base, { backgroundColor: t.bg }]}>
      <Text style={[styles.label, { color: t.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.pill,
    alignSelf: "flex-start",
  },
  label: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
  },
});
