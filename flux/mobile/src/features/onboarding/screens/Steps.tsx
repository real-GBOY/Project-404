import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Icon, NextButton, type IconName } from "@/components/ui";
import { colors, radii, space } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import { BodyFieldsGroup } from "../components/BodyFieldsGroup";
import { SelectCard, cardShadow } from "../components/SelectCard";
import { StepHead, StepScroll } from "../components/StepScroll";
import { DAYS, DURATIONS, EQUIPMENT, EXPERIENCE, GOALS, SPLITS } from "../data";
import type { Body, Option, Selection, Units } from "../types";

// ── selection-card steps (goal / experience / split / equipment) ──────────
type SelectProps = {
  title: string;
  sub?: string;
  items: Option[];
  value: string;
  onPick: (id: string) => void;
  onNext: () => void;
};

export function StepSelect({ title, sub, items, value, onPick, onNext }: SelectProps) {
  return (
    <>
      <StepScroll>
        <StepHead title={title} sub={sub} />
        <View style={styles.list}>
          {items.map((it) => (
            <SelectCard
              key={it.id}
              item={it}
              selected={value === it.id}
              onPress={() => onPick(it.id)}
            />
          ))}
        </View>
      </StepScroll>
      <NextButton onPress={onNext} />
    </>
  );
}

// ── frequency + session length ────────────────────────────────────────────
type FreqProps = {
  sel: Selection;
  set: <K extends keyof Selection>(k: K, v: Selection[K]) => void;
  onNext: () => void;
};

export function StepFrequency({ sel, set, onNext }: FreqProps) {
  return (
    <>
      <StepScroll>
        <StepHead title="HOW MANY DAYS PER WEEK?" />
        <View style={styles.daysRow}>
          {DAYS.map((n) => {
            const on = sel.days === n;
            return (
              <Pressable
                key={n}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  void Haptics.selectionAsync().catch(() => undefined);
                  set("days", n);
                }}
                style={[styles.day, on && styles.dayOn]}
              >
                <Text style={[styles.dayText, on && { color: colors.ink }]}>{n}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.subhead}>HOW LONG ARE YOUR SESSIONS?</Text>
        <View style={styles.grid}>
          {DURATIONS.map((d) => {
            const on = sel.duration === d.id;
            return (
              <Pressable
                key={d.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  void Haptics.selectionAsync().catch(() => undefined);
                  set("duration", d.id);
                }}
                style={[styles.dur, on && styles.durOn]}
              >
                <View style={[styles.durIcon, on && { backgroundColor: colors.lime }]}>
                  <Icon name={d.icon} size={20} color={on ? colors.ink : colors.chipIcon} />
                </View>
                <Text style={styles.durText}>{d.title}</Text>
              </Pressable>
            );
          })}
        </View>
      </StepScroll>
      <NextButton onPress={onNext} />
    </>
  );
}

// ── body data ─────────────────────────────────────────────────────────────
type BodyProps = {
  body: Body;
  setBody: (b: Body) => void;
  units: Units;
  setUnits: (u: Units) => void;
  onNext: () => void;
};

export function StepBody({ body, setBody, units, setUnits, onNext }: BodyProps) {
  return (
    <>
      <StepScroll>
        <StepHead title="YOUR BODY INFO" sub="Helps us personalize your program — optional" />
        <BodyFieldsGroup body={body} setBody={setBody} units={units} setUnits={setUnits} />
      </StepScroll>
      <NextButton
        onPress={onNext}
        footer={
          <Pressable accessibilityRole="button" onPress={onNext} style={styles.skip} hitSlop={8}>
            <Text style={styles.skipText}>Skip for now</Text>
          </Pressable>
        }
      />
    </>
  );
}

// ── review ────────────────────────────────────────────────────────────────
type ReviewProps = { sel: Selection; body: Body; units: Units; onFinish: () => void };

export function StepReview({ sel, body, units, onFinish }: ReviewProps) {
  const find = (arr: Option[], id: string) => arr.find((x) => x.id === id);
  const goal = find(GOALS, sel.goal);
  const exp = find(EXPERIENCE, sel.exp);
  const split = find(SPLITS, sel.split);
  const equip = find(EQUIPMENT, sel.equip);
  const dur = find(DURATIONS, sel.duration);
  const rows: { label: string; value: string; icon: IconName }[] = [
    { label: "Goal", value: goal?.title ?? "—", icon: goal?.icon ?? "target" },
    { label: "Experience", value: exp?.title ?? "—", icon: exp?.icon ?? "bars" },
    { label: "Split", value: split?.title ?? "—", icon: split?.icon ?? "zap" },
    { label: "Equipment", value: equip?.title ?? "—", icon: equip?.icon ?? "dumbbell" },
    { label: "Days / week", value: `${sel.days} DAYS`, icon: "calendar" },
    { label: "Session", value: dur?.title ?? "—", icon: "clock" },
    { label: "Age", value: `${body.age || "—"} YRS`, icon: "person" },
    { label: "Weight", value: `${body.weight || "—"} ${units.w.toUpperCase()}`, icon: "scale" },
  ];
  return (
    <>
      <StepScroll>
        <StepHead title="YOUR TRAINING PROFILE" sub="Here's what we'll build for you" />
        <View style={styles.reviewWrap}>
          <View style={styles.reviewCard}>
            {rows.map((r, i) => (
              <View key={r.label}>
                <View style={styles.reviewRow}>
                  <View style={styles.reviewIcon}>
                    <Icon name={r.icon} size={16} color={colors.limeDim} />
                  </View>
                  <Text style={styles.reviewLabel}>{r.label}</Text>
                  <Text style={styles.reviewValue}>{r.value}</Text>
                </View>
                {i < rows.length - 1 ? <View style={styles.divider} /> : null}
              </View>
            ))}
          </View>
          <Text style={styles.note}>
            We'll create <Text style={styles.noteNum}>3</Text> workout templates for you
            automatically
          </Text>
        </View>
      </StepScroll>
      <NextButton label="START TRAINING" onPress={onFinish} />
    </>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.xl, gap: 11 },
  daysRow: { flexDirection: "row", gap: 10, paddingHorizontal: space.xl },
  day: {
    flex: 1,
    height: 64,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.outline,
    alignItems: "center",
    justifyContent: "center",
    ...cardShadow,
  },
  dayOn: {
    backgroundColor: colors.lime,
    borderColor: colors.lime,
    shadowColor: colors.lime,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  dayText: { fontFamily: fonts.display, fontSize: 28, color: colors.dayIdle },
  subhead: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.ink,
    letterSpacing: 0.52,
    paddingHorizontal: space.xl,
    paddingTop: 24,
    paddingBottom: 16,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 11, paddingHorizontal: space.xl },
  dur: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hair,
    borderRadius: radii.card,
    padding: 15,
    gap: space.md,
    ...cardShadow,
  },
  durOn: { backgroundColor: colors.limeTint, borderColor: colors.limeBorder },
  durIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    backgroundColor: colors.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  durText: { fontFamily: fonts.display, fontSize: 19, color: colors.ink, letterSpacing: 0.57 },
  skip: { alignSelf: "center", marginTop: 14 },
  skipText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.limeDim },
  reviewWrap: { paddingHorizontal: space.xl },
  reviewCard: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderLeftWidth: 3,
    borderLeftColor: colors.lime,
    paddingVertical: space.xs,
    paddingHorizontal: space.lg,
    ...cardShadow,
  },
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
  },
  reviewIcon: {
    width: 30,
    height: 30,
    borderRadius: radii.sm,
    backgroundColor: colors.limeTintStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewLabel: { flex: 1, fontFamily: fonts.body, fontSize: 12.5, color: colors.sub },
  reviewValue: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: colors.ink,
    letterSpacing: 0.51,
    textAlign: "right",
  },
  divider: { height: 1, backgroundColor: colors.hair },
  note: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.sub,
    textAlign: "center",
    marginTop: 18,
    marginHorizontal: 10,
    lineHeight: 19,
  },
  noteNum: { fontFamily: fonts.display, fontSize: 18, color: colors.limeDim, letterSpacing: 0.36 },
});
