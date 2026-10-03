import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "@/lib/alert";
import { BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Card,
  Icon,
  IconButton,
  Label,
  LimeButton,
  Num,
  Ring,
  SectionLabel,
} from "@/components/ui";
import { Screen } from "@/components/ui/Screen";
import { equipmentOf } from "@/features/builder/library";
import { trackingOf } from "@/features/training/catalog";
import { platesPerSide } from "@/features/training/engine";
import { fmtResult, fmtTarget, shapeOf } from "@/features/training/format";
import type { SetType } from "@/features/training/types";
import { useRestRemaining, useTraining } from "@/features/training/store";
import { useUnits } from "@/features/training/units";
import { colors, em } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import { Stepper } from "./Stepper";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const KG_STEP = 2.5;

export function WorkoutScreen() {
  const router = useRouter();
  const units = useUnits();
  const {
    workout,
    startWorkout,
    discardWorkout,
    finishWorkout,
    setDraft,
    logSet,
    nextExercise,
    targetOf,
  } = useTraining();
  const [setType, setSetType] = useState<SetType>("normal");
  const restState = useRestRemaining();

  // Deep link / reload with no running workout → start today's plan.
  // `leaving` stops that auto-start from firing right after we discard / finish.
  const leaving = useRef(false);
  useEffect(() => {
    if (!workout && !leaving.current) startWorkout();
  }, [workout, startWorkout]);

  const leave = useCallback(() => {
    leaving.current = true;
    if (router.canGoBack()) router.back();
    else router.replace("/home");
  }, [router]);

  const totalSets = workout?.exercises.reduce((n, e) => n + e.sets.length, 0) ?? 0;

  const finish = useCallback(() => {
    if (totalSets === 0) {
      Alert.alert("Nothing logged", "Log at least one set before finishing.");
      return;
    }
    leaving.current = true;
    const saved = finishWorkout();
    if (saved) router.replace("/summary");
    else leave();
  }, [totalSets, finishWorkout, leave, router]);

  const confirmExit = useCallback(() => {
    if (totalSets === 0) {
      discardWorkout();
      leave();
      return true;
    }
    Alert.alert(
      "Leave workout?",
      "Your logged sets are safe until you decide.",
      [
        { text: "Finish & save", onPress: finish },
        { text: "Pause — resume later", onPress: leave },
        {
          text: "Discard workout",
          style: "destructive",
          onPress: () => {
            discardWorkout();
            leave();
          },
        },
      ],
      { cancelable: true },
    );
    return true;
  }, [totalSets, discardWorkout, leave, finish]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", confirmExit);
      return () => sub.remove();
    }, [confirmExit]),
  );

  if (!workout) return null;
  const entry = workout.exercises[workout.index]!;
  const { ex, sets } = entry;
  // Superset group containing the current exercise: slot labels 1A / 1B ...
  let groupEnd = workout.index;
  while (workout.links[groupEnd]) groupEnd++;
  let groupStart = workout.index;
  while (workout.links[groupStart - 1]) groupStart--;
  const inGroup = groupEnd > groupStart;
  const slot = String.fromCharCode(65 + workout.index - groupStart);
  const upNextIdx = groupEnd + 1;
  const isLast = upNextIdx >= workout.exercises.length;
  const upNext = isLast ? null : workout.exercises[upNextIdx]!.ex;
  const { kg, reps } = workout.draft;
  const target = targetOf(ex);
  const shape = shapeOf(ex);
  const delta = target.kg - ex.lastKg;
  const fmtU = { show: units.show, short: units.short };

  const onLog = () => {
    if ((shape.weighted && kg <= 0) || reps <= 0) {
      Alert.alert("Check your numbers", "Weight and reps must be greater than zero.");
      return;
    }
    const res = logSet(kg, reps, setType);
    setSetType("normal");
    if (res?.newPR) {
      router.push({
        pathname: "/pr",
        params: { exercise: ex.name, kg: String(kg), previous: String(res.previousKg) },
      });
    }
  };

  return (
    <Screen gap={14}>
      {/* header */}
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

      <View style={{ marginTop: 4 }}>
        <View style={styles.exMeta}>
          <Label size={11}>{inGroup ? `Superset · ${slot}` : "Current exercise"}</Label>
          {inGroup ? <Text style={styles.noRest}>No rest between</Text> : null}
        </View>
        <Text style={styles.exName}>{ex.name.toUpperCase()}</Text>
        <View style={styles.exMeta}>
          <Pressable
            accessibilityRole="button"
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

      {/* last time + target */}
      <View style={styles.pair}>
        <Card style={[styles.half, { backgroundColor: colors.lastTime }]}>
          <Label size={10}>Last time</Label>
          <View style={styles.big}>
            <Num size={24}>{fmtResult(ex, ex.lastKg, ex.lastReps, fmtU)}</Num>
          </View>
        </Card>
        <Card style={[styles.half, { borderLeftWidth: 3, borderLeftColor: colors.lime }]}>
          <View style={styles.targetHead}>
            <Label size={10} color={colors.ink}>
              Target
            </Label>
            {trackingOf(ex) === "weight_reps" && delta !== 0 ? (
              <View style={styles.targetBadge}>
                <Text style={styles.targetBadgeText}>
                  {delta >= 0 ? "+" : ""}
                  {units.show(delta)} {units.label}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.big}>
            <Num size={24}>{fmtTarget(ex, target.kg, target.repLow, target.repHigh, fmtU)}</Num>
          </View>
        </Card>
      </View>
      <View style={styles.reason}>
        <View style={styles.reasonDot} />
        <Text style={styles.reasonText}>{target.reason}</Text>
        {target.daysSince >= 14 ? <Text style={styles.away}>AWAY {target.daysSince}d</Text> : null}
      </View>

      {/* set type */}
      <View style={styles.types}>
        {SET_TYPES.map((t) => {
          const on = t.id === setType;
          return (
            <Pressable
              key={t.id}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => setSetType(t.id)}
              style={[styles.typeChip, on && { backgroundColor: t.bg ?? colors.ink }]}
            >
              <Text style={[styles.typeText, { color: on ? (t.fg ?? colors.lime) : colors.sub }]}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* steppers */}
      <View style={styles.pair}>
        {shape.load ? (
          <Stepper
            label={shape.loadLabel}
            unit={units.label}
            display={units.show(kg)}
            onMinus={() => setDraft({ kg: Math.max(0, kg - KG_STEP), reps })}
            onPlus={() => setDraft({ kg: kg + KG_STEP, reps })}
          />
        ) : null}
        <Stepper
          label={shape.repsLabel}
          unit={trackingOf(ex) === "time" ? "sec" : undefined}
          display={String(reps)}
          onMinus={() => setDraft({ kg, reps: Math.max(shape.repsStep, reps - shape.repsStep) })}
          onPlus={() => setDraft({ kg, reps: reps + shape.repsStep })}
        />
      </View>

      {shape.weighted && equipmentOf(ex) === "Barbell" ? (
        <PlateRow kg={kg} unitShort={units.short} show={units.show} />
      ) : null}

      {/* rest timer */}
      {restState ? (
        <Card dark style={styles.rest} onPress={() => router.push("/rest")}>
          <Ring
            value={restState.total - restState.remaining}
            total={restState.total}
            size={56}
            stroke={5}
            track={colors.whiteA12}
          >
            <Num size={20} color={colors.white}>
              {mmss(restState.remaining)}
            </Num>
          </Ring>
          <View style={{ flex: 1 }}>
            <Label size={10} color={colors.whiteA50}>
              Rest timer
            </Label>
            <Text style={styles.restText}>Next set in {restState.remaining}s</Text>
          </View>
          <SkipRest />
        </Card>
      ) : null}

      {/* voice + log */}
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

      {/* sets logged */}
      <View style={{ marginTop: 4 }}>
        <SectionLabel>Sets logged · {sets.length}</SectionLabel>
        <View style={styles.sets}>
          {sets.map((s) => (
            <View key={s.n} style={styles.setRow}>
              <View
                style={[
                  styles.setNum,
                  s.type && s.type !== "normal" && { backgroundColor: TYPE_BG[s.type] },
                ]}
              >
                <Text
                  style={[
                    styles.setNumText,
                    s.type && s.type !== "normal" && { color: TYPE_FG[s.type] },
                  ]}
                >
                  {s.type && s.type !== "normal" ? TYPE_TAG[s.type] : s.n}
                </Text>
              </View>
              <Text style={styles.setLabel}>Set {s.n}</Text>
              <View style={{ flex: 1 }} />
              <Num size={18}>{fmtResult(ex, s.kg, s.reps, fmtU)}</Num>
              {s.delta ? (
                <Text
                  style={[
                    styles.delta,
                    s.delta.kind === "pr" && { color: colors.ink, backgroundColor: colors.lime },
                    s.delta.kind === "up" && {
                      color: colors.limeDeep,
                      backgroundColor: colors.limeTintStrong,
                    },
                    s.delta.kind === "down" && {
                      color: colors.plateauTitle,
                      backgroundColor: colors.plateauBg,
                    },
                  ]}
                >
                  {s.delta.label}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      </View>

      {/* up next / finish */}
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

const SET_TYPES: { id: SetType; label: string; bg?: string; fg?: string }[] = [
  { id: "normal", label: "Normal" },
  { id: "warmup", label: "Warm-up", bg: colors.segment, fg: colors.sub },
  { id: "dropset", label: "Drop Set", bg: colors.dropBg, fg: colors.drop },
  { id: "failure", label: "Failure", bg: colors.plateauBg, fg: colors.plateauTitle },
];
const TYPE_BG: Record<SetType, string> = {
  normal: colors.limeTintStrong,
  warmup: colors.segment,
  dropset: colors.dropBg,
  failure: colors.plateauBg,
};
const TYPE_FG: Record<SetType, string> = {
  normal: colors.limeDeep,
  warmup: colors.sub,
  dropset: colors.drop,
  failure: colors.plateauTitle,
};
const TYPE_TAG: Record<SetType, string> = { normal: "", warmup: "W", dropset: "D", failure: "F" };

/** Plates to load on each side of a 20 kg bar for the weight in the stepper. */
function PlateRow({
  kg,
  unitShort,
  show,
}: {
  kg: number;
  unitShort: string;
  show: (kg: number) => string;
}) {
  const { plates, bar, remainder } = platesPerSide(kg);
  if (plates.length === 0) {
    return (
      <Text style={styles.plateText}>
        Bar only · {show(bar)} {unitShort}
      </Text>
    );
  }
  return (
    <View style={styles.plates}>
      <Text style={styles.plateText}>Per side:</Text>
      {plates.map((p) => (
        <Text key={p.plate} style={styles.plate}>
          {show(p.plate)}
          <Text style={styles.plateSub}>
            {unitShort}×{p.count}
          </Text>
        </Text>
      ))}
      <Text style={styles.plateText}>
        + {show(bar)}
        {unitShort} bar
      </Text>
      {remainder > 0.01 ? (
        <Text style={[styles.plateText, { color: colors.plateauTitle }]}>
          ({show(remainder)}
          {unitShort} not loadable)
        </Text>
      ) : null}
    </View>
  );
}

function SkipRest() {
  const { skipRest } = useTraining();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Skip rest"
      onPress={skipRest}
      style={styles.skip}
    >
      <Text style={styles.skipText}>Skip</Text>
    </Pressable>
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
  exName: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 38,
    color: colors.ink,
    letterSpacing: 0.68,
    marginTop: 3,
  },
  pair: { flexDirection: "row", gap: 12 },
  exMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  swap: { fontFamily: fonts.bodySemi, fontSize: 11.5, color: colors.limeDeep, marginTop: 4 },
  replaced: { fontFamily: fonts.body, fontSize: 11, color: colors.sub, marginTop: 4 },
  noRest: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.limeDim,
    backgroundColor: colors.limeTintStrong,
    borderRadius: 99,
    paddingVertical: 2,
    paddingHorizontal: 8,
    overflow: "hidden",
  },
  reason: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 2 },
  reasonDot: {
    width: 4,
    height: 4,
    borderRadius: 99,
    backgroundColor: colors.limeDim,
    marginTop: 6,
  },
  reasonText: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: colors.sub, lineHeight: 17 },
  away: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: colors.away,
    backgroundColor: colors.awayBg,
    borderRadius: 99,
    paddingVertical: 2,
    paddingHorizontal: 7,
    overflow: "hidden",
  },
  types: { flexDirection: "row", gap: 6 },
  typeChip: {
    flex: 1,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.segment,
    alignItems: "center",
    justifyContent: "center",
  },
  typeText: { fontFamily: fonts.bodyBold, fontSize: 10.5 },
  plates: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 2,
  },
  plate: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.ink,
    backgroundColor: colors.trackLight,
    borderRadius: 7,
    paddingVertical: 3,
    paddingHorizontal: 7,
    overflow: "hidden",
  },
  plateSub: { fontFamily: fonts.body, color: colors.sub },
  plateText: { fontFamily: fonts.body, fontSize: 10.5, color: colors.sub },
  half: { flex: 1, padding: 14 },
  big: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 8 },
  reps: { fontFamily: fonts.body, fontSize: 11, color: colors.sub },
  targetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  targetBadge: {
    backgroundColor: colors.limeTintStrong,
    borderRadius: 99,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  targetBadgeText: { fontFamily: fonts.bodyBold, fontSize: 10.5, color: colors.limeDeep },
  rest: { padding: 16, flexDirection: "row", alignItems: "center", gap: 16 },
  restText: { fontFamily: fonts.body, fontSize: 13, color: colors.white, marginTop: 3 },
  skip: {
    backgroundColor: colors.whiteA10,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  skipText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.white },
  actions: { alignItems: "center", gap: 12, marginTop: 2 },
  mic: {
    width: 56,
    height: 56,
    borderRadius: 99,
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
  sets: { gap: 8, marginTop: 10 },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: colors.shadowInk,
    shadowOpacity: 0.04,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  setNum: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: colors.limeTintStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  setNumText: { fontFamily: fonts.display, fontSize: 15, color: colors.limeDeep },
  setLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.sub },
  delta: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    color: colors.sub,
    backgroundColor: colors.segment,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 99,
    overflow: "hidden",
  },
  next: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.dashed,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  nextName: { fontFamily: fonts.display, fontSize: 18, color: colors.ink, letterSpacing: 0.54 },
});
