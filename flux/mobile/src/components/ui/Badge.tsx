import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import { colors, radii, space } from "@/theme/tokens";
import { fonts } from "@/theme/typography";

export type BadgeTone = "pr" | "up" | "down" | "flat" | "lime" | "warn";

const TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  pr: { bg: colors.lime, fg: colors.ink },
  up: { bg: colors.limeTintStrong, fg: colors.limeDeep },
  down: { bg: colors.plateauBg, fg: colors.plateauTitle },
  flat: { bg: colors.segment, fg: colors.sub },
  lime: { bg: colors.limeTintStrong, fg: colors.limeDim },
  warn: { bg: colors.awayBg, fg: colors.away },
};

/** Small pill label — set deltas, "No rest between", "AWAY 24d", progress changes. */
export function Badge({
  label,
  tone = "flat",
  size = 10.5,
  style,
}: {
  label: string;
  tone?: BadgeTone;
  size?: number;
  style?: StyleProp<TextStyle>;
}) {
  const t = TONES[tone];
  return (
    <Text style={[styles.base, { fontSize: size, color: t.fg, backgroundColor: t.bg }, style]}>
      {label}
    </Text>
  );
}

/** A set delta (`SetDelta.kind`) is already one of the tones. */
export const DeltaBadge = ({
  delta,
  size,
}: {
  delta: { label: string; kind: BadgeTone };
  size?: number;
}) => <Badge label={delta.label} tone={delta.kind} size={size} />;

const styles = StyleSheet.create({
  base: {
    fontFamily: fonts.bodyBold,
    paddingVertical: 3,
    paddingHorizontal: space.sm,
    borderRadius: radii.pill,
    overflow: "hidden",
  },
});
