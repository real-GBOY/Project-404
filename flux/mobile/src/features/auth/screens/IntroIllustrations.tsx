import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Icon, Num } from "@/components/ui";
import { colors, dark, radii, space } from "@/theme/tokens";
import { fonts } from "@/theme/typography";

/** Barbell plate (slide 1). */
export function Plate() {
  return (
    <View style={styles.wrap}>
      <View style={styles.halo} />
      <View style={styles.plate}>
        <View style={styles.hub} />
      </View>
      <View style={[styles.end, { left: -14 }]} />
      <View style={[styles.end, { right: -14 }]} />
    </View>
  );
}

function Ripple({ delay }: { delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.ease) }), -1),
    );
  }, [t, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - t.value),
    transform: [{ scale: 0.7 + 1.4 * t.value }],
  }));
  return <Animated.View style={[styles.ripple, style]} />;
}

/** Pulsing microphone (slide 2). */
export function Voice() {
  return (
    <View style={styles.wrap}>
      {[0, 800, 1600].map((d) => (
        <Ripple key={d} delay={d} />
      ))}
      <View style={styles.mic}>
        <Icon name="mic" size={38} color={colors.ink} />
      </View>
    </View>
  );
}

const BOARD = [
  { rank: 1, name: "Karim", vol: "32.4", you: false },
  { rank: 2, name: "You", vol: "28.9", you: true },
  { rank: 3, name: "Layla", vol: "24.1", you: false },
];

/** Weekly-volume leaderboard (slide 3). Sample data. */
export function Leaderboard() {
  return (
    <View style={{ gap: 10, marginTop: 36 }}>
      {BOARD.map((r) => (
        <View key={r.rank} style={[styles.row, r.you && styles.rowYou]}>
          <View style={{ width: 30, alignItems: "center" }}>
            {r.rank === 1 ? (
              <Icon name="trophy" size={22} color={colors.lime} />
            ) : (
              <Num size={22} color={dark.sub}>
                {r.rank}
              </Num>
            )}
          </View>
          <View style={styles.avatar}>
            <Num size={17} color={r.you ? colors.lime : colors.white}>
              {r.name[0]}
            </Num>
          </View>
          <Text style={styles.name}>{r.name}</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 3 }}>
            <Num size={24} color={r.you ? colors.lime : colors.white}>
              {r.vol}
            </Num>
            <Text style={styles.unit}>t</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 168, height: 168, alignItems: "center", justifyContent: "center" },
  halo: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.limeA18,
  },
  plate: {
    width: 132,
    height: 132,
    borderRadius: radii.pill,
    borderWidth: 14,
    borderColor: colors.lime,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.lime,
    shadowOpacity: 0.25,
    shadowRadius: 20,
  },
  hub: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: dark.bg,
    borderWidth: 3,
    borderColor: colors.whiteA12,
  },
  end: {
    position: "absolute",
    top: 69,
    width: 28,
    height: 30,
    borderRadius: 6,
    backgroundColor: colors.lime,
  },
  ripple: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.lime,
  },
  mic: {
    width: 96,
    height: 96,
    borderRadius: radii.pill,
    backgroundColor: colors.lime,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.lime,
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
    borderRadius: radii.card,
    backgroundColor: dark.card,
    borderWidth: 1,
    borderColor: colors.whiteA06,
  },
  rowYou: { backgroundColor: colors.limeA10, borderColor: colors.limeA30 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    backgroundColor: colors.darkAvatar,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.white },
  unit: { fontFamily: fonts.body, fontSize: 11, color: dark.sub },
});
