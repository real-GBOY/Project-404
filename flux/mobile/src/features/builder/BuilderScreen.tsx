import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Alert } from "@/lib/alert";
import { ChoiceSheet, Icon, IconButton, LimeButton, Num } from "@/components/ui";
import { Screen } from "@/components/ui/Screen";
import { EXERCISES } from "@/features/training/catalog";
import { useTraining } from "@/features/training/store";
import { useUnits } from "@/features/training/units";
import { colors } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import { builderDraft, useBuilderDraft } from "./draft";

const REP_PRESETS = ["3-5", "5-8", "6-8", "8-10", "8-12", "10-12", "12-15", "15-20"];

export function BuilderScreen() {
  const router = useRouter();
  const units = useUnits();
  const { saveRoutine, startRoutine, routines } = useTraining();
  const [duplicating, setDuplicating] = useState(false);
  const { name, items, linked } = useBuilderDraft();

  // Opening the builder starts a fresh draft; the picker pushes on top without remounting it.
  useEffect(() => {
    builderDraft.reset();
  }, []);

  const totalSets = items.reduce((n, i) => n + i.sets, 0);
  const patchItem = (idx: number, p: Partial<(typeof items)[number]>) =>
    builderDraft.patch({ items: items.map((it, i) => (i === idx ? { ...it, ...p } : it)) });
  const remove = (idx: number) => {
    const nextLinked: Record<number, boolean> = {};
    for (const [k, v] of Object.entries(linked)) {
      const n = Number(k);
      if (n < idx) nextLinked[n] = v;
      else if (n > idx) nextLinked[n - 1] = v;
    }
    builderDraft.patch({ items: items.filter((_, i) => i !== idx), linked: nextLinked });
  };

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
        <IconButton label="Back" size={40} radius={12} onPress={() => router.back()}>
          <Icon name="back" size={18} color={colors.ink} />
        </IconButton>
        <Pressable
          accessibilityRole="button"
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
          if (r)
            builderDraft.set({ name: `${r.name} copy`, items: r.items, linked: r.linked ?? {} });
        }}
        onClose={() => setDuplicating(false)}
      />
      <TextInput
        value={name}
        onChangeText={(t) => builderDraft.patch({ name: t })}
        style={styles.name}
        accessibilityLabel="Workout name"
        placeholder="Workout name"
        placeholderTextColor={colors.sub}
      />
      <Text style={styles.count}>
        {items.length} exercises · {totalSets} sets
      </Text>

      <View style={styles.list}>
        {items.map((it, i) => {
          const ex = EXERCISES[it.id]!;
          const inSuper = !!linked[i] || !!linked[i - 1];
          return (
            <View key={it.id} style={{ gap: 10 }}>
              <View style={[styles.card, inSuper && styles.cardSuper]}>
                <View style={styles.cardHead}>
                  <Icon name="filter" size={16} color={colors.handle} />
                  {inSuper ? (
                    <Text style={styles.ab}>{linked[i - 1] && !linked[i] ? "1B" : "1A"}</Text>
                  ) : null}
                  <Text style={styles.exName}>{ex.name}</Text>
                  <Pressable
                    accessibilityLabel={`Remove ${ex.name}`}
                    onPress={() => remove(i)}
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
                      style={styles.miniBtn}
                      onPress={() => patchItem(i, { sets: Math.max(1, it.sets - 1) })}
                      accessibilityLabel="Fewer sets"
                    >
                      <Icon name="minus" size={13} color={colors.ink} />
                    </Pressable>
                    <Num size={17}>{it.sets} sets</Num>
                    <Pressable
                      style={styles.miniBtn}
                      onPress={() => patchItem(i, { sets: it.sets + 1 })}
                      accessibilityLabel="More sets"
                    >
                      <Icon name="plus" size={13} color={colors.ink} />
                    </Pressable>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Rep range ${it.reps}, tap to change`}
                    style={styles.pill}
                    onPress={() => {
                      const at = REP_PRESETS.indexOf(it.reps);
                      patchItem(i, { reps: REP_PRESETS[(at + 1) % REP_PRESETS.length]! });
                    }}
                  >
                    <Text style={styles.pillText}>{it.reps} reps</Text>
                  </Pressable>
                  <View
                    style={[
                      styles.pill,
                      { backgroundColor: colors.limeTintStrong, marginLeft: "auto" },
                    ]}
                  >
                    <View style={styles.targetRow}>
                      <Pressable
                        accessibilityLabel="Lower target weight"
                        hitSlop={6}
                        onPress={() => patchItem(i, { targetKg: Math.max(0, it.targetKg - 2.5) })}
                      >
                        <Icon name="minus" size={12} color={colors.limeDeep} />
                      </Pressable>
                      <Num size={15} color={colors.limeDeep}>
                        {units.show(it.targetKg)} {units.label}
                      </Num>
                      <Pressable
                        accessibilityLabel="Raise target weight"
                        hitSlop={6}
                        onPress={() => patchItem(i, { targetKg: it.targetKg + 2.5 })}
                      >
                        <Icon name="plus" size={12} color={colors.limeDeep} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
              {i < items.length - 1 ? (
                <Pressable
                  onPress={() => builderDraft.patch({ linked: { ...linked, [i]: !linked[i] } })}
                  style={styles.link}
                >
                  <View style={[styles.linkLine, linked[i] && { backgroundColor: colors.lime }]} />
                  <Icon
                    name="layers"
                    size={14}
                    color={linked[i] ? colors.limeDim : colors.chevron}
                  />
                  <Text
                    style={[styles.linkText, { color: linked[i] ? colors.limeDim : colors.muted }]}
                  >
                    {linked[i] ? "Superset — no rest between" : "Link as superset"}
                  </Text>
                  <View style={[styles.linkLine, linked[i] && { backgroundColor: colors.lime }]} />
                </Pressable>
              ) : null}
            </View>
          );
        })}

        <Pressable
          accessibilityRole="button"
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
  targetRow: { flexDirection: "row", alignItems: "center", gap: 8 },
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
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.hair,
    padding: 14,
    paddingLeft: 10,
  },
  cardSuper: { borderColor: colors.limeBorder, borderLeftWidth: 3, borderLeftColor: colors.lime },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  ab: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: colors.limeDim,
    backgroundColor: colors.limeTintStrong,
    borderRadius: 99,
    paddingVertical: 2,
    paddingHorizontal: 6,
    overflow: "hidden",
  },
  exName: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    paddingLeft: 26,
  },
  setsBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.soft,
    borderRadius: 11,
    paddingVertical: 6,
    paddingHorizontal: 8,
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
    borderRadius: 11,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  pillText: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.ink },
  link: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 2,
  },
  linkLine: { width: 20, height: 1, backgroundColor: colors.divider },
  linkText: { fontFamily: fonts.bodySemi, fontSize: 10.5 },
  add: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.dashed,
    borderRadius: 16,
    paddingVertical: 15,
    marginTop: 2,
  },
  addText: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.limeDim },
});
