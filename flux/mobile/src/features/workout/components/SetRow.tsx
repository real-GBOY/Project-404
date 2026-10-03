import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { DeltaBadge, Num } from "@/components/ui";
import type { Exercise } from "@/features/training/catalog";
import { fmtResult } from "@/features/training/format";
import type { LoggedSet } from "@/features/training/types";
import { colors, radii, space } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import { SET_TYPE_BADGE } from "../setTypes";

type Props = {
  ex: Exercise;
  set: LoggedSet;
  fmt: { show: (kg: number) => string; short: string };
};

/** One logged set: number / type tag, result, and the delta badge. */
export const SetRow = memo(function SetRow({ ex, set, fmt }: Props) {
  const badge = SET_TYPE_BADGE[set.type ?? "normal"];
  const result = fmtResult(ex, set.kg, set.reps, fmt);
  return (
    <View
      style={styles.row}
      accessibilityLabel={`Set ${set.n}, ${result}${set.delta ? `, ${set.delta.label}` : ""}`}
    >
      <View style={[styles.num, { backgroundColor: badge.bg }]}>
        <Text style={[styles.numText, { color: badge.fg }]}>{badge.tag ?? set.n}</Text>
      </View>
      <Text style={styles.label}>Set {set.n}</Text>
      <View style={{ flex: 1 }} />
      <Num size={18}>{result}</Num>
      {set.delta ? <DeltaBadge delta={set.delta} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    shadowColor: colors.shadowInk,
    shadowOpacity: 0.04,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  num: {
    width: 26,
    height: 26,
    borderRadius: radii.sm - 1,
    alignItems: "center",
    justifyContent: "center",
  },
  numText: { fontFamily: fonts.display, fontSize: 15 },
  label: { fontFamily: fonts.body, fontSize: 12, color: colors.sub },
});
