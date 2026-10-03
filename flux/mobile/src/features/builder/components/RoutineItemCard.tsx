import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon, Num } from "@/components/ui";
import { useUnits } from "@/features/auth/units";
import { EXERCISES } from "@/features/training/catalog";
import type { RoutineItem } from "@/features/training/types";
import { colors, radii, space } from "@/theme/tokens";
import { fonts } from "@/theme/typography";

const REP_PRESETS = ["3-5", "5-8", "6-8", "8-10", "8-12", "10-12", "12-15", "15-20"];

type Props = {
  item: RoutineItem;
  /** Part of a superset: "A" (first) or "B" (partner), else null. */
  superset: "A" | "B" | null;
  onPatch: (p: Partial<RoutineItem>) => void;
  onRemove: () => void;
};

/** One exercise in the Builder: sets stepper, rep-range preset, target weight. */
export const RoutineItemCard = memo(function RoutineItemCard({
  item,
  superset,
  onPatch,
  onRemove,
}: Props) {
  const units = useUnits();
  const ex = EXERCISES[item.id]!;
  return (
    <View style={[styles.card, superset && styles.cardSuper]}>
      <View style={styles.head}>
        <Icon name="filter" size={16} color={colors.handle} />
        {superset ? <Text style={styles.ab}>{superset === "A" ? "1A" : "1B"}</Text> : null}
        <Text style={styles.name}>{ex.name}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${ex.name}`}
          onPress={onRemove}
          hitSlop={8}
        >
          <View style={{ transform: [{ rotate: "45deg" }] }}>
            <Icon name="plus" size={16} color={colors.plateauTitle} strokeWidth={2} />
          </View>
        </Pressable>
      </View>
      <View style={styles.controls}>
        <View style={styles.setsBox}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fewer sets"
            style={styles.miniBtn}
            onPress={() => onPatch({ sets: Math.max(1, item.sets - 1) })}
          >
            <Icon name="minus" size={13} color={colors.ink} />
          </Pressable>
          <Num size={17}>{item.sets} sets</Num>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More sets"
            style={styles.miniBtn}
            onPress={() => onPatch({ sets: item.sets + 1 })}
          >
            <Icon name="plus" size={13} color={colors.ink} />
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Rep range ${item.reps}, tap to change`}
          style={styles.pill}
          onPress={() => {
            const at = REP_PRESETS.indexOf(item.reps);
            onPatch({ reps: REP_PRESETS[(at + 1) % REP_PRESETS.length]! });
          }}
        >
          <Text style={styles.pillText}>{item.reps} reps</Text>
        </Pressable>
        <View style={[styles.pill, styles.target]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Lower target weight"
            hitSlop={6}
            onPress={() => onPatch({ targetKg: Math.max(0, item.targetKg - 2.5) })}
          >
            <Icon name="minus" size={12} color={colors.limeDeep} />
          </Pressable>
          <Num size={15} color={colors.limeDeep}>
            {units.show(item.targetKg)} {units.label}
          </Num>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Raise target weight"
            hitSlop={6}
            onPress={() => onPatch({ targetKg: item.targetKg + 2.5 })}
          >
            <Icon name="plus" size={12} color={colors.limeDeep} />
          </Pressable>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.hair,
    padding: 14,
    paddingLeft: 10,
  },
  cardSuper: { borderColor: colors.limeBorder, borderLeftWidth: 3, borderLeftColor: colors.lime },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  ab: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: colors.limeDim,
    backgroundColor: colors.limeTintStrong,
    borderRadius: radii.pill,
    paddingVertical: 2,
    paddingHorizontal: 6,
    overflow: "hidden",
  },
  name: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink },
  controls: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, paddingLeft: 26 },
  setsBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.soft,
    borderRadius: radii.md,
    paddingVertical: 6,
    paddingHorizontal: space.sm,
  },
  miniBtn: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    backgroundColor: colors.soft,
    borderRadius: radii.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  pillText: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.ink },
  target: {
    backgroundColor: colors.limeTintStrong,
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
});
