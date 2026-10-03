import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, IconButton, LimeButton } from "@/components/ui";
import { dayByName } from "@/features/training/plan";
import { useTraining } from "@/features/training/store";
import { fmtResult } from "@/features/training/format";
import { repRange, targetFor } from "@/features/training/engine";
import { useUnits } from "@/features/training/units";
import { colors } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import { builderDraft, newItem } from "./draft";
import { ALL_EXERCISES, FAVORITE_IDS, MUSCLE_FILTERS, equipmentOf } from "./library";

type Tab = "recent" | "favorites" | "all";
const TABS: [Tab, string][] = [
  ["recent", "Recent"],
  ["favorites", "Favorites"],
  ["all", "All"],
];

export function ExercisePickerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const units = useUnits();
  const { sessions, todayPlan, workout, swapExercise } = useTraining();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const swapping = mode === "swap";
  const [tab, setTab] = useState<Tab>("recent");
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<(typeof MUSCLE_FILTERS)[number]>("All");
  const [added, setAdded] = useState<string[]>([]);

  const taken = swapping
    ? (workout?.exercises.map((e) => e.ex.id) ?? [])
    : builderDraft.get().items.map((i) => i.id);
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

  const toggle = (id: string) =>
    setAdded((a) =>
      swapping
        ? a.includes(id)
          ? []
          : [id]
        : a.includes(id)
          ? a.filter((x) => x !== id)
          : [...a, id],
    );

  const confirm = () => {
    if (swapping) {
      const ex = ALL_EXERCISES.find((e) => e.id === added[0]);
      if (ex) swapExercise(ex);
      router.back();
      return;
    }
    const cur = builderDraft.get();
    builderDraft.patch({
      items: [
        ...cur.items,
        ...added.map((id) => {
          const ex = ALL_EXERCISES.find((e) => e.id === id)!;
          const { low, high } = repRange(ex);
          return newItem(id, targetFor(ex).kg, `${low}-${high}`);
        }),
      ],
    });
    router.back();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{swapping ? "SWAP EXERCISE" : "ADD EXERCISE"}</Text>
          <IconButton label="Close" size={38} radius={12} onPress={() => router.back()}>
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
        <View style={styles.tabs}>
          {TABS.map(([id, label]) => {
            const on = tab === id;
            return (
              <Pressable
                key={id}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => setTab(id)}
                style={[styles.tab, on && { backgroundColor: colors.ink }]}
              >
                <Text style={[styles.tabText, { color: on ? colors.lime : colors.sub }]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {MUSCLE_FILTERS.map((m) => {
            const on = muscle === m;
            return (
              <Pressable
                key={m}
                onPress={() => setMuscle(m)}
                style={[
                  styles.chip,
                  on && { backgroundColor: colors.limeTintStrong, borderColor: colors.lime },
                ]}
              >
                <Text style={[styles.chipText, { color: on ? colors.limeDeep : colors.sub }]}>
                  {m}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {list.length === 0 ? (
          <Text style={styles.empty}>No exercises match. Try a different filter.</Text>
        ) : null}
        {list.map((e) => {
          const on = added.includes(e.id);
          return (
            <Pressable
              key={e.id}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => toggle(e.id)}
              style={[styles.row, on && styles.rowOn]}
            >
              <View style={[styles.icon, on && { backgroundColor: colors.lime }]}>
                <Icon name="dumbbell" size={19} color={on ? colors.ink : colors.idleIcon} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{e.name}</Text>
                <View style={styles.meta}>
                  <Text style={styles.metaText}>
                    {e.muscle} · {equipmentOf(e)}
                  </Text>
                  <View style={styles.sep} />
                  <Text style={styles.last}>
                    {fmtResult(e, e.lastKg, e.lastReps, { show: units.show, short: units.short })}
                  </Text>
                </View>
              </View>
              <View style={[styles.tick, on && { backgroundColor: colors.lime }]}>
                <Icon
                  name={on ? "check" : "plus"}
                  size={14}
                  color={on ? colors.ink : colors.mutedIcon}
                />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: 14 + insets.bottom }]}>
        <LimeButton
          label={
            swapping
              ? added.length
                ? "SWAP EXERCISE"
                : "SELECT AN EXERCISE"
              : added.length
                ? `ADD ${added.length} EXERCISE${added.length > 1 ? "S" : ""}`
                : "SELECT EXERCISES"
          }
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
  head: { paddingHorizontal: 20 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, letterSpacing: 0.78 },
  search: {
    marginTop: 14,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hair,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
  },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink, padding: 0 },
  tabs: { flexDirection: "row", gap: 8, marginTop: 14 },
  tab: {
    flex: 1,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.trackLight,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: { fontFamily: fonts.bodySemi, fontSize: 12.5 },
  chips: { gap: 8, marginTop: 12, paddingBottom: 2 },
  chip: {
    height: 30,
    paddingHorizontal: 13,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.hair,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 12 },
  list: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10, gap: 9 },
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
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rowOn: { backgroundColor: colors.limeTint, borderColor: colors.limeBorder },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink },
  meta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  metaText: { fontFamily: fonts.body, fontSize: 11, color: colors.sub },
  sep: { width: 3, height: 3, borderRadius: 99, backgroundColor: colors.dot },
  last: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.limeDim },
  tick: {
    width: 26,
    height: 26,
    borderRadius: 99,
    backgroundColor: colors.trackLight,
    alignItems: "center",
    justifyContent: "center",
  },
  bar: { paddingHorizontal: 20, paddingTop: 12 },
});
