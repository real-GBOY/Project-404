import { useCallback, useEffect, useRef } from "react";
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
import { targetKg } from "@/features/training/catalog";
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
  const { workout, startWorkout, discardWorkout, finishWorkout, setDraft, logSet, nextExercise } =
    useTraining();
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
    finishWorkout();
    leave();
  }, [totalSets, finishWorkout, leave]);

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
  const isLast = workout.index === workout.exercises.length - 1;
  const upNext = isLast ? null : workout.exercises[workout.index + 1]!.ex;
  const { kg, reps } = workout.draft;
  const target = targetKg(ex);
  const delta = target - ex.lastKg;

  const onLog = () => {
    if (kg <= 0 || reps <= 0) {
      Alert.alert("Check your numbers", "Weight and reps must be greater than zero.");
      return;
    }
    const res = logSet(kg, reps);
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
        <Label size={11}>Current exercise</Label>
        <Text style={styles.exName}>{ex.name.toUpperCase()}</Text>
      </View>

      {/* last time + target */}
      <View style={styles.pair}>
        <Card style={[styles.half, { backgroundColor: colors.lastTime }]}>
          <Label size={10}>Last time</Label>
          <View style={styles.big}>
            <Num size={26}>{units.show(ex.lastKg)}</Num>
            <Num size={14} color={colors.sub}>
              {units.label}
            </Num>
          </View>
          <Text style={styles.reps}>× {ex.lastReps} reps</Text>
        </Card>
        <Card style={[styles.half, { borderLeftWidth: 3, borderLeftColor: colors.lime }]}>
          <View style={styles.targetHead}>
            <Label size={10} color={colors.ink}>
              Target
            </Label>
            <View style={styles.targetBadge}>
              <Text style={styles.targetBadgeText}>
                +{units.show(delta)} {units.label}
              </Text>
            </View>
          </View>
          <View style={styles.big}>
            <Num size={26}>{units.show(target)}</Num>
            <Num size={14} color={colors.sub}>
              {units.label}
            </Num>
          </View>
          <Text style={styles.reps}>× {ex.lastReps} reps</Text>
        </Card>
      </View>

      {/* steppers */}
      <View style={styles.pair}>
        <Stepper
          label="Weight"
          unit={units.label}
          display={units.show(kg)}
          onMinus={() => setDraft({ kg: Math.max(0, kg - KG_STEP), reps })}
          onPlus={() => setDraft({ kg: kg + KG_STEP, reps })}
        />
        <Stepper
          label="Reps"
          display={String(reps)}
          onMinus={() => setDraft({ kg, reps: Math.max(1, reps - 1) })}
          onPlus={() => setDraft({ kg, reps: reps + 1 })}
        />
      </View>

      {/* rest timer */}
      {restState ? (
        <Card dark style={styles.rest} onPress={() => router.push("/rest")}>
          <Ring
            value={restState.total - restState.remaining}
            total={restState.total}
            size={56}
            stroke={5}
            track="rgba(255,255,255,0.12)"
          >
            <Num size={20} color="#fff">
              {mmss(restState.remaining)}
            </Num>
          </Ring>
          <View style={{ flex: 1 }}>
            <Label size={10} color="rgba(255,255,255,0.5)">
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
              <View style={styles.setNum}>
                <Text style={styles.setNumText}>{s.n}</Text>
              </View>
              <Text style={styles.setLabel}>Set {s.n}</Text>
              <View style={{ flex: 1 }} />
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
                <Num size={20}>{units.show(s.kg)}</Num>
                <Text style={styles.setLabel}>
                  {units.short} × {s.reps}
                </Text>
              </View>
              <View style={styles.setDivider} />
              <Text style={styles.setLabel}>RPE {s.rpe}</Text>
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
  restText: { fontFamily: fonts.body, fontSize: 13, color: "#fff", marginTop: 3 },
  skip: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  skipText: { fontFamily: fonts.bodySemi, fontSize: 12, color: "#fff" },
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
    shadowColor: "#141414",
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
  setDivider: { width: 1, height: 16, backgroundColor: colors.hair },
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
