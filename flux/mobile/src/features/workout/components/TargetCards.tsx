import { StyleSheet, Text, View } from "react-native";
import { Badge, Card, Label, Num } from "@/components/ui";
import { trackingOf, type Exercise } from "@/features/training/catalog";
import type { Target } from "@/features/training/engine";
import { fmtResult, fmtTarget } from "@/features/training/format";
import { colors, space, radii } from "@/theme/tokens";
import { fonts } from "@/theme/typography";

type Props = {
  ex: Exercise;
  /** The real last performance (from history). */
  last: { kg: number; reps: number };
  target: Target & { daysSince: number };
  fmt: { show: (kg: number) => string; short: string };
  unitLabel: string;
};

/** "Last time" and "Target" cards plus the one-line reason from the progression engine. */
export function TargetCards({ ex, last, target, fmt, unitLabel }: Props) {
  const delta = target.kg - last.kg;
  return (
    <>
      <View style={styles.pair}>
        <Card style={[styles.half, { backgroundColor: colors.lastTime }]}>
          <Label size={10}>Last time</Label>
          <View style={styles.big}>
            <Num size={24}>{fmtResult(ex, last.kg, last.reps, fmt)}</Num>
          </View>
        </Card>
        <Card style={[styles.half, { borderLeftWidth: 3, borderLeftColor: colors.lime }]}>
          <View style={styles.head}>
            <Label size={10} color={colors.ink}>
              Target
            </Label>
            {trackingOf(ex) === "weight_reps" && delta !== 0 ? (
              <Badge tone="up" label={`${delta >= 0 ? "+" : ""}${fmt.show(delta)} ${unitLabel}`} />
            ) : null}
          </View>
          <View style={styles.big}>
            <Num size={24}>{fmtTarget(ex, target.kg, target.repLow, target.repHigh, fmt)}</Num>
          </View>
        </Card>
      </View>
      <View style={styles.reason}>
        <View style={styles.dot} />
        <Text style={styles.reasonText}>{target.reason}</Text>
        {target.daysSince >= 14 ? (
          <Badge tone="warn" size={9} label={`AWAY ${target.daysSince}d`} />
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: "row", gap: space.md },
  half: { flex: 1, padding: 14 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  big: { flexDirection: "row", alignItems: "baseline", gap: space.sm, marginTop: 8 },
  reason: { flexDirection: "row", alignItems: "flex-start", gap: space.sm, paddingHorizontal: 2 },
  dot: {
    width: 4,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.limeDim,
    marginTop: 6,
  },
  reasonText: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: colors.sub, lineHeight: 17 },
});
