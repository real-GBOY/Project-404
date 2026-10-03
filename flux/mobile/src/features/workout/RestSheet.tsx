import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, dark, em } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import { useRestRemaining, useTraining } from "@/features/training/store";
import { useUnits } from "@/features/training/units";

const SIZE = 140;
const STROKE = 6;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Rest-timer overlay (design screen 14). Shares its clock with the inline card on the workout screen. */
export function RestSheet() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const units = useUnits();
  const { workout, skipRest, addRest } = useTraining();
  const rest = useRestRemaining();

  const closed = useRef(false);
  // Skip / auto-finish / backdrop can all fire; only ever pop the sheet once.
  const close = () => {
    if (closed.current) return;
    closed.current = true;
    if (router.canGoBack()) router.back();
    else router.replace("/workout");
  };

  // Rest finished (or skipped from the inline card) → drop the overlay.
  useEffect(() => {
    if (!rest) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rest === null]);

  if (!rest) return null;
  const r = (SIZE - STROKE) / 2;
  const circ = 2 * Math.PI * r;
  const pct = rest.total ? rest.remaining / rest.total : 0;
  const draft = workout?.draft;

  return (
    <View style={styles.root}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Dismiss" />
      <View style={[styles.sheet, { paddingBottom: 30 + insets.bottom }]}>
        <View style={styles.grab} />
        <Text style={styles.rest}>REST</Text>
        <View style={{ width: SIZE, height: SIZE, marginTop: 12 }}>
          <Svg width={SIZE} height={SIZE} style={{ transform: [{ rotate: "-90deg" }] }}>
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={r}
              fill="none"
              stroke={colors.whiteA12}
              strokeWidth={STROKE}
            />
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={r}
              fill="none"
              stroke={colors.lime}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - pct)}
            />
          </Svg>
          <View style={styles.center}>
            <Text style={styles.time}>{mmss(rest.remaining)}</Text>
            <Text style={styles.remaining}>seconds remaining</Text>
          </View>
        </View>
        <View style={styles.buttons}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              skipRest();
              close();
            }}
            style={styles.skip}
          >
            <Text style={styles.skipText}>Skip rest</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => addRest(30)} style={styles.add}>
            <Text style={styles.addText}>ADD 30s</Text>
          </Pressable>
        </View>
        {draft ? (
          <Text style={styles.next}>
            Next set target:{" "}
            <Text style={styles.nextBold}>
              {units.show(draft.kg)} {units.label} × {draft.reps}
            </Text>
          </Text>
        ) : null}
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
  grab: { width: 40, height: 5, borderRadius: 99, backgroundColor: colors.whiteA20 },
  rest: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.sub,
    letterSpacing: em(14, 0.2),
    marginTop: 14,
  },
  center: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  time: {
    fontFamily: fonts.display,
    fontSize: 44,
    lineHeight: 46,
    color: colors.white,
    letterSpacing: 0.9,
  },
  remaining: { fontFamily: fonts.body, fontSize: 11, color: colors.sub, marginTop: 2 },
  buttons: { flexDirection: "row", gap: 12, width: "100%", marginTop: 18, alignItems: "center" },
  skip: { flex: 1, height: 48, alignItems: "center", justifyContent: "center" },
  skipText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.sub },
  add: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  addText: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.lime,
    letterSpacing: em(18, 0.08),
  },
  next: { marginTop: 14, fontFamily: fonts.body, fontSize: 11.5, color: colors.sub },
  nextBold: { fontFamily: fonts.bodySemi, color: colors.white },
});
