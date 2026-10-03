import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { Badge, Icon, IconButton, Label, LimeButton, Num, SectionLabel } from "@/components/ui";
import { TabPills } from "@/components/ui/Chips";
import { Screen } from "@/components/ui/Screen";
import { useUnits } from "@/features/auth/units";
import { shapeOf } from "@/features/training/format";
import { useTrainingActions, useTrainingState, useWorkoutDraft } from "@/features/training/store";
import type { SetType } from "@/features/training/types";
import { groupBounds } from "@/features/training/workout";
import { Alert } from "@/lib/alert";
import { colors, em, space, radii } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import { InputSteppers } from "./components/InputSteppers";
import { PlateRow } from "./components/PlateRow";
import { RestCard } from "./components/RestCard";
import { SetRow } from "./components/SetRow";
import { TargetCards } from "./components/TargetCards";
import { SET_TYPE_OPTIONS } from "./setTypes";
import { useWorkoutExit } from "./useWorkoutExit";

/** Active workout: pick weight / reps, log the set, see the delta, rest, move on. */
export function WorkoutScreen() {
  const router = useRouter();
  const units = useUnits();
  const { workout } = useTrainingState();
  const { setDraft, logSet, nextExercise, targetOf } = useTrainingActions();
  const draft = useWorkoutDraft();
  const [setType, setSetType] = useState<SetType>("normal");

  const totalSets = workout?.exercises.reduce((n, e) => n + e.sets.length, 0) ?? 0;
  const { leaving, finish, confirmExit } = useWorkoutExit(totalSets);

  // Opened with no running workout (stale link): Home is the only sensible place to be.
  if (!workout) return leaving.current ? null : <Redirect href="/home" />;

  const entry = workout.exercises[workout.index]!;
  const { ex, sets } = entry;
  const { start, end } = groupBounds(workout.links, workout.index);
  const inGroup = end > start;
  const slot = String.fromCharCode(65 + workout.index - start);
  const upNext = end + 1 >= workout.exercises.length ? null : workout.exercises[end + 1]!.ex;
  const target = targetOf(ex);
  const shape = shapeOf(ex);
  const fmt = { show: units.show, short: units.short };

  const onLog = () => {
    if ((shape.weighted && draft.kg <= 0) || draft.reps <= 0) {
      Alert.alert("Check your numbers", "Weight and reps must be greater than zero.");
      return;
    }
    const res = logSet(draft.kg, draft.reps, setType);
    setSetType("normal");
    if (res?.newPR) {
      router.push({
        pathname: "/pr",
        params: { exercise: ex.name, kg: String(draft.kg), previous: String(res.previousKg) },
      });
    }
  };

  return (
    <Screen gap={14}>
      <View style={styles.header}>
        <IconButton label="Back" onPress={confirmExit}>
          <Icon name="back" size={20} color={colors.ink} />
        </IconButton>
        <View style={{ alignItems: "center" }}>
          <Text style={styles.day}>{workout.day}</Text>
          <Text style={styles.progress}>
            Exercise {workout.index + 1} / {workout.exercises.length}
          </Text>
        </View>
        <View style={styles.setBadge} accessibilityLabel={`${totalSets} sets logged`}>
          <Num size={17} color={colors.lime}>
            {totalSets}
          </Num>
        </View>
      </View>

      <View style={{ marginTop: space.xs }}>
        <View style={styles.meta}>
          <Label size={11}>{inGroup ? `Superset · ${slot}` : "Current exercise"}</Label>
          {inGroup ? <Badge tone="lime" size={10} label="No rest between" /> : null}
        </View>
        <Text style={styles.exName}>{ex.name.toUpperCase()}</Text>
        <View style={styles.meta}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Swap exercise"
            onPress={() => router.push({ pathname: "/picker", params: { mode: "swap" } })}
            hitSlop={8}
          >
            <Text style={styles.swap}>Swap exercise</Text>
          </Pressable>
          {entry.planned ? (
            <Text style={styles.replaced}>Replaced {entry.planned.name}</Text>
          ) : null}
        </View>
      </View>

      <TargetCards ex={ex} target={target} fmt={fmt} unitLabel={units.label} />

      <TabPills
        options={SET_TYPE_OPTIONS}
        value={setType}
        onChange={setSetType}
        height={30}
        radius={9}
        fontSize={10.5}
        gap={6}
        bold
      />

      <InputSteppers ex={ex} draft={draft} onChange={setDraft} units={units} />
      {shape.weighted && ex.equipment === "Barbell" ? (
        <PlateRow kg={draft.kg} unitShort={units.short} show={units.show} />
      ) : null}

      <RestCard />

      <View style={styles.actions}>
        <View style={{ alignItems: "center", gap: 7 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Log by voice"
            onPress={() => router.push("/voice")}
            style={({ pressed }) => [styles.mic, pressed && { transform: [{ scale: 0.95 }] }]}
          >
            <Icon name="mic" size={24} color={colors.ink} />
          </Pressable>
          <Text style={styles.micLabel}>Log by voice</Text>
        </View>
        <LimeButton label="LOG SET" variant="ink" icon={null} fontSize={23} onPress={onLog} />
      </View>

      <View style={{ marginTop: space.xs }}>
        <SectionLabel>Sets logged · {sets.length}</SectionLabel>
        <View style={styles.sets}>
          {sets.map((s) => (
            <SetRow key={s.n} ex={ex} set={s} fmt={fmt} />
          ))}
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={upNext ? `Up next, ${upNext.name}` : "Finish workout"}
        onPress={upNext ? () => nextExercise() : finish}
        style={styles.next}
      >
        <Label size={10}>{upNext ? "Up next" : "Last exercise"}</Label>
        <Text style={styles.nextName}>{upNext ? upNext.name.toUpperCase() : "FINISH WORKOUT"}</Text>
        <View style={{ flex: 1 }} />
        <Icon name={upNext ? "arrowRight" : "check"} size={18} color={colors.sub} />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  day: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 24,
    color: colors.ink,
    letterSpacing: em(22, 0.04),
  },
  progress: { fontFamily: fonts.body, fontSize: 11, color: colors.sub, marginTop: 2 },
  setBadge: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  meta: { flexDirection: "row", alignItems: "center", gap: space.sm },
  exName: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 38,
    color: colors.ink,
    letterSpacing: 0.68,
    marginTop: 3,
  },
  swap: { fontFamily: fonts.bodySemi, fontSize: 11.5, color: colors.limeDeep, marginTop: 4 },
  replaced: { fontFamily: fonts.body, fontSize: 11, color: colors.sub, marginTop: 4 },
  actions: { alignItems: "center", gap: space.md, marginTop: 2 },
  mic: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.lime,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.lime,
    shadowOpacity: 0.4,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  micLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.sub },
  sets: { gap: space.sm, marginTop: 10 },
  next: {
    marginTop: space.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.dashed,
    borderRadius: radii.lg,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
  },
  nextName: { fontFamily: fonts.display, fontSize: 18, color: colors.ink, letterSpacing: 0.54 },
});
