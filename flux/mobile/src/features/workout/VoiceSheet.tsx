import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/ui";
import { useTraining } from "@/features/training/store";
import { useUnits } from "@/features/training/units";
import { colors, dark, em } from "@/theme/tokens";
import { fonts } from "@/theme/typography";

const LISTEN_MS = 1800;
const LEFT = [16, 30];
const RIGHT = [28, 18];

/**
 * Pulls "<weight> kilos|pounds" and "<n> reps" out of an utterance.
 * Returns the weight in kg so it can go straight into logSet.
 */
export function parseVoice(text: string): { kg: number; reps: number } | null {
  const w = /(\d+(?:\.\d+)?)\s*(kilos?|kgs?|pounds?|lbs?)/i.exec(text);
  const r = /(\d+)\s*reps?/i.exec(text);
  if (!w || !r) return null;
  const value = parseFloat(w[1]!);
  const isLb = /^(p|l)/i.test(w[2]!);
  return { kg: isLb ? value / 2.20462 : value, reps: parseInt(r[1]!, 10) };
}

function Bar({ h, delay, period }: { h: number; delay: number; period: number }) {
  const s = useSharedValue(0.35);
  useEffect(() => {
    s.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: period, easing: Easing.inOut(Easing.ease) }), -1, true),
    );
  }, [s, delay, period]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: s.value }] }));
  return <Animated.View style={[styles.wave, { height: h }, style]} />;
}

function Pulse({ children }: { children: React.ReactNode }) {
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = withRepeat(withTiming(0.4, { duration: 700 }), -1, true);
  }, [o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/**
 * Voice-logging overlay (design screen 13).
 *
 * Speech recognition isn't available inside Expo Go, so the "heard" phrase is
 * simulated from the current stepper values and then run through the real
 * parser. Swap `heard` for a speech-to-text result to make it live.
 */
export function VoiceSheet() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const units = useUnits();
  const { workout, logSet } = useTraining();
  const [listening, setListening] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setListening(false), LISTEN_MS);
    return () => clearTimeout(t);
  }, []);

  const entry = workout?.exercises[workout.index];
  const draft = workout?.draft;

  const heard = useMemo(() => {
    if (!entry || !draft) return "";
    const lbs = units.label === "LBS";
    const amount = lbs ? Math.round(draft.kg * 2.20462) : draft.kg;
    return `${entry.ex.name} ${amount} ${lbs ? "pounds" : "kilos"} ${draft.reps} reps`;
  }, [entry, draft, units.label]);

  const parsed = useMemo(() => parseVoice(heard), [heard]);

  const close = () => (router.canGoBack() ? router.back() : router.replace("/workout"));

  const confirm = () => {
    if (!parsed || !entry) return;
    const res = logSet(parsed.kg, parsed.reps);
    if (res?.newPR) {
      router.replace({
        pathname: "/pr",
        params: {
          exercise: entry.ex.name,
          kg: String(parsed.kg),
          previous: String(res.previousKg),
        },
      });
    } else {
      close();
    }
  };

  const showArabic = entry?.ex.id === "bench" && draft?.kg === 80;

  return (
    <View style={styles.root}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Dismiss" />
      <View style={[styles.sheet, { paddingBottom: 30 + insets.bottom }]}>
        <View style={styles.grab} />
        <Pulse>
          <Text style={styles.listening}>{listening ? "LISTENING..." : "GOT IT"}</Text>
        </Pulse>

        <View style={styles.micRow}>
          {LEFT.map((h, i) => (
            <Bar key={`l${i}`} h={h} delay={i * 100} period={700 + i * 150} />
          ))}
          <View style={styles.mic}>
            <Icon name="mic" size={32} color={colors.ink} />
          </View>
          {RIGHT.map((h, i) => (
            <Bar key={`r${i}`} h={h} delay={i * 120} period={800 - i * 120} />
          ))}
        </View>

        {!listening && parsed && entry ? (
          <>
            <View style={styles.transcript}>
              <Text style={styles.heard}>{heard}</Text>
              {showArabic ? <Text style={styles.arabic}>بنش بريس ثمانين كيلو</Text> : null}
            </View>
            <View style={styles.parsed}>
              <View style={styles.tick}>
                <Icon name="check" size={15} color={colors.ink} />
              </View>
              <Text style={styles.parsedText}>
                {entry.ex.name.toUpperCase()} · {units.show(parsed.kg)} {units.label} ·{" "}
                {parsed.reps} REPS
              </Text>
            </View>
          </>
        ) : (
          <View style={{ height: 96 }} />
        )}

        <View style={styles.buttons}>
          <Pressable accessibilityRole="button" onPress={close} style={styles.cancel}>
            <Text style={styles.cancelText}>CANCEL</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={listening || !parsed}
            onPress={confirm}
            style={[styles.confirm, (listening || !parsed) && { opacity: 0.4 }]}
          >
            <Text style={styles.confirmText}>CONFIRM</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.blackA70, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: dark.sheet,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 14,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  grab: {
    width: 40,
    height: 5,
    borderRadius: 99,
    backgroundColor: colors.whiteA20,
    marginBottom: 16,
  },
  listening: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.lime,
    letterSpacing: em(18, 0.14),
  },
  micRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 18, height: 80 },
  wave: { width: 5, borderRadius: 99, backgroundColor: colors.lime },
  mic: {
    width: 80,
    height: 80,
    borderRadius: 99,
    backgroundColor: colors.lime,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 6,
    shadowColor: colors.lime,
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  transcript: { marginTop: 14, alignItems: "center" },
  heard: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.white, textAlign: "center" },
  arabic: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.sub,
    marginTop: 4,
    writingDirection: "rtl",
  },
  parsed: {
    width: "100%",
    marginTop: 16,
    backgroundColor: colors.limeA10,
    borderWidth: 1,
    borderColor: colors.limeA30,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tick: {
    width: 26,
    height: 26,
    borderRadius: 99,
    backgroundColor: colors.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  parsedText: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.white,
    letterSpacing: em(18, 0.04),
  },
  buttons: { flexDirection: "row", gap: 12, width: "100%", marginTop: 14 },
  cancel: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.whiteA20,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.white,
    letterSpacing: em(18, 0.1),
  },
  confirm: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmText: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.ink,
    letterSpacing: em(18, 0.1),
  },
});
