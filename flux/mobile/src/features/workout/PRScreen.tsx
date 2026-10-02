import { useEffect, useMemo } from "react";
import { Pressable, Share, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, LimeButton, Num } from "@/components/ui";
import { useUnits } from "@/features/training/units";
import { colors, em } from "@/theme/tokens";
import { fonts } from "@/theme/typography";

type Piece = {
  left: number;
  delay: number;
  dur: number;
  size: number;
  lime: boolean;
  round: boolean;
  rot: number;
};

function ConfettiPiece({ p, height }: { p: Piece; height: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      p.delay * 1000,
      withRepeat(withTiming(1, { duration: p.dur * 1000, easing: Easing.linear }), -1),
    );
  }, [t, p]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [
      { translateY: -30 + t.value * (height + 30) },
      { rotate: `${p.rot + t.value * 620}deg` },
    ],
  }));
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: 0,
          left: `${p.left}%`,
          width: p.size,
          height: p.size,
          borderRadius: p.round ? 99 : 2,
          backgroundColor: p.lime ? colors.lime : "#fff",
        },
        style,
      ]}
    />
  );
}

function Confetti() {
  const { height } = useWindowDimensions();
  const pieces = useMemo<Piece[]>(
    () =>
      Array.from({ length: 30 }, () => ({
        left: Math.random() * 100,
        delay: Math.random() * 2.5,
        dur: 2.4 + Math.random() * 1.8,
        size: 6 + Math.random() * 7,
        lime: Math.random() > 0.45,
        round: Math.random() > 0.5,
        rot: Math.random() * 360,
      })),
    [],
  );
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p, i) => (
        <ConfettiPiece key={i} p={p} height={height} />
      ))}
    </View>
  );
}

/** Full-screen "new personal record" celebration (design screen 15). */
export function PRScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const units = useUnits();
  const params = useLocalSearchParams<{ exercise?: string; kg?: string; previous?: string }>();
  const exercise = params.exercise ?? "Bench Press";
  const kg = Number(params.kg ?? 0);
  const previous = Number(params.previous ?? 0);

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, []);

  const close = () => (router.canGoBack() ? router.back() : router.replace("/home"));
  const share = () =>
    void Share.share({
      message: `New PR on FLUX — ${exercise} ${units.show(kg)} ${units.label} 🏆 Every rep counts.`,
    });

  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(withTiming(1.05, { duration: 900 }), withTiming(1, { duration: 900 })),
      -1,
    );
  }, [scale]);
  const trophy = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={[styles.root, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 26 }]}>
      <Confetti />
      <View style={styles.center}>
        <Text style={styles.eyebrow}>NEW PERSONAL RECORD</Text>
        <Animated.View entering={ZoomIn.duration(500)} style={{ marginTop: 28 }}>
          <Animated.View style={[styles.trophy, trophy]}>
            <Icon name="trophy" size={56} color={colors.lime} />
          </Animated.View>
        </Animated.View>
        <Text style={styles.name}>{exercise.toUpperCase()}</Text>
        <View style={styles.big}>
          <Text style={styles.bigNum}>{units.show(kg)}</Text>
          <Num size={30} color={colors.lime}>
            {units.label}
          </Num>
        </View>
        {previous > 0 ? (
          <>
            <Text style={styles.prev}>
              Previous: {units.show(previous)} {units.label}
            </Text>
            <View style={styles.delta}>
              <Icon name="arrowUp" size={14} color={colors.lime} />
              <Text style={styles.deltaText}>
                +{units.show(kg - previous)} {units.label}
              </Text>
            </View>
          </>
        ) : null}
      </View>
      <View style={styles.actions}>
        <LimeButton
          label="SHARE PR"
          variant="outline"
          icon="share"
          iconPosition="left"
          height={54}
          fontSize={21}
          onPress={share}
        />
        <Pressable accessibilityRole="button" onPress={close} hitSlop={10}>
          <Text style={styles.cont}>Continue workout</Text>
        </Pressable>
      </View>
      <View style={styles.brand}>
        <Icon name="dumbbellLogo" size={16} color={colors.lime} />
        <Text style={styles.brandText}>FLUX</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", paddingHorizontal: 28, overflow: "hidden" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  eyebrow: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: colors.lime,
    letterSpacing: em(12, 0.28),
  },
  trophy: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: "rgba(200,255,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontFamily: fonts.display,
    fontSize: 36,
    lineHeight: 40,
    color: "#fff",
    letterSpacing: em(36, 0.03),
    marginTop: 26,
    textAlign: "center",
  },
  big: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 6 },
  bigNum: {
    fontFamily: fonts.display,
    fontSize: 78,
    lineHeight: 84,
    color: colors.lime,
    letterSpacing: 0.8,
  },
  prev: { fontFamily: fonts.body, fontSize: 13, color: colors.sub, marginTop: 8 },
  delta: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(200,255,0,0.12)",
    borderRadius: 99,
    paddingVertical: 7,
    paddingHorizontal: 16,
  },
  deltaText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.lime },
  actions: { alignItems: "center", gap: 14, marginTop: 20 },
  cont: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: "rgba(255,255,255,0.6)" },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 22,
  },
  brandText: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.lime,
    letterSpacing: em(18, 0.1),
  },
});
