import { memo, useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Chip, Icon, IconButton, LimeButton, TabPills, type TabOption } from "@/components/ui";
import { useUnits } from "@/features/auth/units";
import {
  ALL_EXERCISES,
  FAVORITE_IDS,
  MUSCLE_FILTERS,
  type Exercise,
} from "@/features/training/catalog";
import { repRange, targetFor } from "@/features/training/engine";
import { fmtResult } from "@/features/training/format";
import { dayByName } from "@/features/training/plan";
import { useTraining } from "@/features/training/store";
import { colors, radii, space } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import { newItem, useBuilder } from "./draft";

type Tab = "recent" | "favorites" | "all";
const TABS: TabOption<Tab>[] = [
  { id: "recent", label: "Recent" },
  { id: "favorites", label: "Favorites" },
  { id: "all", label: "All" },
];

type Fmt = { show: (kg: number) => string; short: string };

const ExerciseRow = memo(function ExerciseRow({
  ex,
  on,
  fmt,
  onToggle,
}: {
  ex: Exercise;
  on: boolean;
  fmt: Fmt;
  onToggle: (id: string) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${ex.name}, ${ex.muscle}, ${ex.equipment}`}
      accessibilityState={{ selected: on }}
      onPress={() => onToggle(ex.id)}
      style={[styles.row, on && styles.rowOn]}
    >
      <View style={[styles.icon, on && { backgroundColor: colors.lime }]}>
        <Icon name="dumbbell" size={19} color={on ? colors.ink : colors.idleIcon} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{ex.name}</Text>
        <View style={styles.meta}>
          <Text style={styles.metaText}>
            {ex.muscle} · {ex.equipment}
          </Text>
          <View style={styles.sep} />
          <Text style={styles.last}>{fmtResult(ex, ex.lastKg, ex.lastReps, fmt)}</Text>
        </View>
      </View>
      <View style={[styles.tick, on && { backgroundColor: colors.lime }]}>
        <Icon name={on ? "check" : "plus"} size={14} color={on ? colors.ink : colors.mutedIcon} />
      </View>
    </Pressable>
  );
});

/** Exercise picker: adds to the Builder draft, or (mode=swap) replaces the current exercise. */
export function ExercisePickerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const units = useUnits();
  const { sessions, todayPlan, workout, swapExercise } = useTraining();
  const builder = useBuilder();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const swapping = mode === "swap";
  const [tab, setTab] = useState<Tab>("recent");
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<(typeof MUSCLE_FILTERS)[number]>("All");
  const [added, setAdded] = useState<string[]>([]);

  const taken = swapping
    ? (workout?.exercises.map((e) => e.ex.id) ?? [])
    : builder.draft.items.map((i) => i.id);
  const recentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of sessions.slice(0, 3)) dayByName(s.day)?.ids.forEach((id) => ids.add(id));
    todayPlan.exercises.forEach((e) => ids.add(e.id));
    return ids;
  }, [sessions, todayPlan]);

  const list = ALL_EXERCISES.filter((e) => {
    if (taken.includes(e.id)) return false;
    if (tab === "recent" && !recentIds.has(e.id)) return false;
    if (tab === "favorites" && !FAVORITE_IDS.includes(e.id)) return false;
    if (muscle !== "All" && e.muscle !== muscle) return false;
    return !query.trim() || e.name.toLowerCase().includes(query.trim().toLowerCase());
  });

  const toggle = useCallback(
    (id: string) =>
      setAdded((a) =>
        swapping
          ? a.includes(id)
            ? []
            : [id]
          : a.includes(id)
            ? a.filter((x) => x !== id)
            : [...a, id],
      ),
    [swapping],
  );

  const confirm = () => {
    if (swapping) {
      const ex = ALL_EXERCISES.find((e) => e.id === added[0]);
      if (ex) swapExercise(ex);
      router.back();
      return;
    }
    builder.patch((cur) => ({
      items: [
        ...cur.items,
        ...added.map((id) => {
          const ex = ALL_EXERCISES.find((e) => e.id === id)!;
          const { low, high } = repRange(ex);
          return newItem(id, targetFor(ex).kg, `${low}-${high}`);
        }),
      ],
    }));
    router.back();
  };

  const fmt = useMemo(() => ({ show: units.show, short: units.short }), [units.show, units.short]);
  const buttonLabel = swapping
    ? added.length
      ? "SWAP EXERCISE"
      : "SELECT AN EXERCISE"
    : added.length
      ? `ADD ${added.length} EXERCISE${added.length > 1 ? "S" : ""}`
      : "SELECT EXERCISES";

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{swapping ? "SWAP EXERCISE" : "ADD EXERCISE"}</Text>
          <IconButton label="Close" size={38} radius={radii.chip} onPress={() => router.back()}>
            <View style={{ transform: [{ rotate: "45deg" }] }}>
              <Icon name="plus" size={16} color={colors.ink} strokeWidth={2} />
            </View>
          </IconButton>
        </View>
        <View style={styles.search}>
          <Icon name="filter" size={17} color={colors.sub} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search exercises"
            placeholderTextColor={colors.sub}
            style={styles.input}
            accessibilityLabel="Search exercises"
          />
        </View>
        <View style={{ marginTop: 14 }}>
          <TabPills options={TABS} value={tab} onChange={setTab} />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {MUSCLE_FILTERS.map((m) => (
            <Chip key={m} label={m} selected={muscle === m} onPress={() => setMuscle(m)} />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={list}
        keyExtractor={(e) => e.id}
        extraData={added}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.empty}>No exercises match. Try a different filter.</Text>
        }
        renderItem={({ item }) => (
          <ExerciseRow ex={item} on={added.includes(item.id)} fmt={fmt} onToggle={toggle} />
        )}
      />

      <View style={[styles.bar, { paddingBottom: 14 + insets.bottom }]}>
        <LimeButton
          label={buttonLabel}
          icon={null}
          fontSize={20}
          height={54}
          disabled={added.length === 0}
          onPress={confirm}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  head: { paddingHorizontal: space.xl },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, letterSpacing: 0.78 },
  search: {
    marginTop: 14,
    height: 46,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hair,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
  },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink, padding: 0 },
  chips: { gap: space.sm, marginTop: space.md, paddingBottom: 2 },
  list: { paddingHorizontal: space.xl, paddingTop: 14, paddingBottom: 10, gap: 9 },
  empty: {
    textAlign: "center",
    padding: 40,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.sub,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hair,
    borderRadius: radii.lg,
    paddingVertical: space.md,
    paddingHorizontal: 14,
  },
  rowOn: { backgroundColor: colors.limeTint, borderColor: colors.limeBorder },
  icon: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    backgroundColor: colors.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink },
  meta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  metaText: { fontFamily: fonts.body, fontSize: 11, color: colors.sub },
  sep: { width: 3, height: 3, borderRadius: radii.pill, backgroundColor: colors.dot },
  last: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.limeDim },
  tick: {
    width: 26,
    height: 26,
    borderRadius: radii.pill,
    backgroundColor: colors.trackLight,
    alignItems: "center",
    justifyContent: "center",
  },
  bar: { paddingHorizontal: space.xl, paddingTop: space.md },
});
