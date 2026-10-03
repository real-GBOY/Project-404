import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { ChoiceSheet, Icon, IconButton, LimeButton } from "@/components/ui";
import { Screen } from "@/components/ui/Screen";
import { useTraining } from "@/features/training/store";
import { Alert } from "@/lib/alert";
import { colors, radii } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import { RoutineItemCard } from "./components/RoutineItemCard";
import { SupersetLink } from "./components/SupersetLink";
import { removeItemAt, useBuilder } from "./draft";

/** Build a workout: name it, add exercises, set sets / reps / target, link supersets, save. */
export function BuilderScreen() {
  const router = useRouter();
  const { saveRoutine, startRoutine, routines } = useTraining();
  const [duplicating, setDuplicating] = useState(false);
  const builder = useBuilder();
  const { name, items, linked } = builder.draft;

  // Opening the builder starts a fresh draft; the picker pushes on top without remounting it.
  const { reset } = builder;
  useEffect(() => {
    reset();
  }, [reset]);

  const totalSets = items.reduce((n, i) => n + i.sets, 0);

  const save = () => {
    if (items.length === 0) {
      Alert.alert("Add an exercise", "A workout needs at least one exercise.");
      return;
    }
    const title = name.trim() || "My Workout";
    saveRoutine({ id: `r-${Date.now()}`, name: title, items, linked });
    Alert.alert("Workout saved", `${title} is ready.`, [
      {
        text: "Start now",
        onPress: () => {
          const ids = items.map((i) => i.id);
          if (startRoutine(title, ids, linked)) router.replace("/workout");
        },
      },
      { text: "Done", style: "cancel", onPress: () => router.back() },
    ]);
  };

  return (
    <Screen gap={0}>
      <View style={styles.top}>
        <IconButton label="Back" size={40} radius={radii.chip} onPress={() => router.back()}>
          <Icon name="back" size={18} color={colors.ink} />
        </IconButton>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Duplicate a saved workout"
          hitSlop={8}
          onPress={() =>
            routines.length
              ? setDuplicating(true)
              : Alert.alert("No saved workouts yet", "Save a workout first, then duplicate it.")
          }
        >
          <Text style={styles.duplicate}>Duplicate</Text>
        </Pressable>
      </View>
      <ChoiceSheet
        visible={duplicating}
        title="DUPLICATE A WORKOUT"
        options={routines.map((r) => r.name)}
        value=""
        onSelect={(n) => {
          const r = routines.find((x) => x.name === n);
          if (r) builder.set({ name: `${r.name} copy`, items: r.items, linked: r.linked ?? {} });
        }}
        onClose={() => setDuplicating(false)}
      />
      <TextInput
        value={name}
        onChangeText={(t) => builder.patch({ name: t })}
        style={styles.name}
        accessibilityLabel="Workout name"
        placeholder="Workout name"
        placeholderTextColor={colors.sub}
      />
      <Text style={styles.count}>
        {items.length} exercises · {totalSets} sets
      </Text>

      <View style={styles.list}>
        {items.map((it, i) => (
          <View key={it.id} style={{ gap: 10 }}>
            <RoutineItemCard
              item={it}
              superset={linked[i] ? "A" : linked[i - 1] ? "B" : null}
              onPatch={(p) =>
                builder.patch((cur) => ({
                  items: cur.items.map((x, j) => (j === i ? { ...x, ...p } : x)),
                }))
              }
              onRemove={() => builder.patch((cur) => removeItemAt(cur, i))}
            />
            {i < items.length - 1 ? (
              <SupersetLink
                on={!!linked[i]}
                onToggle={() =>
                  builder.patch((cur) => ({ linked: { ...cur.linked, [i]: !cur.linked[i] } }))
                }
              />
            ) : null}
          </View>
        ))}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add exercise"
          onPress={() => router.push("/picker")}
          style={styles.add}
        >
          <Icon name="plus" size={16} color={colors.limeDim} />
          <Text style={styles.addText}>Add exercise</Text>
        </Pressable>
      </View>

      <View style={{ marginTop: 18 }}>
        <LimeButton label="SAVE WORKOUT" icon={null} fontSize={21} onPress={save} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  duplicate: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.sub },
  name: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.ink,
    letterSpacing: 0.64,
    marginTop: 10,
    padding: 0,
  },
  count: { fontFamily: fonts.body, fontSize: 12, color: colors.sub, marginTop: 2 },
  list: { marginTop: 16, gap: 10 },
  add: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.dashed,
    borderRadius: radii.card,
    paddingVertical: 15,
    marginTop: 2,
  },
  addText: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.limeDim },
});
