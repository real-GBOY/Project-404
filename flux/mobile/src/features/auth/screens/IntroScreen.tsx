import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import Animated, {
  Easing,
  FadeInLeft,
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon, LimeButton, Num } from "@/components/ui";
import { colors, dark, em } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import { useSession } from "../session";

const SLIDES = ["plate", "voice", "compete"] as const;

export function IntroScreen() {
  const router = useRouter();
  const { markIntroSeen } = useSession();
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState<"fwd" | "back">("fwd");
  const last = page === SLIDES.length - 1;

  const go = (to: number) => {
    if (to < 0 || to >= SLIDES.length || to === page) return;
    setDir(to > page ? "fwd" : "back");
    setPage(to);
  };

  const next = () => {
    if (last) {
      markIntroSeen();
      router.push("/sign-up");
      return;
    }
    go(page + 1);
  };

  // Horizontal swipe changes slide (state-driven, so it behaves the same on web and native).
  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-24, 24])
    .onEnd((e) => {
      if (e.translationX < -50) go(page + 1);
      else if (e.translationX > 50) go(page - 1);
    });

  return (
    <SafeAreaView style={styles.root}>
      <GestureDetector gesture={swipe}>
        <Animated.View
          key={page}
          entering={(dir === "fwd" ? FadeInRight : FadeInLeft).duration(280)}
          style={styles.slide}
        >
          {page === 0 && (
            <>
              <Plate />
              <Copy
                title="TRAIN SMARTER"
                body="FLUX tells you exactly what to lift today, based on your last session — no guesswork."
              />
            </>
          )}
          {page === 1 && (
            <>
              <Voice />
              <Copy
                title="LOG BY VOICE"
                body="Say it in Arabic or English — FLUX logs the set instantly."
              >
                <View style={styles.sample}>
                  <View style={styles.sampleDot} />
                  <Text style={styles.sampleText}>بنش بريس ثمانين كيلو</Text>
                </View>
              </Copy>
            </>
          )}
          {page === 2 && (
            <>
              <Copy
                title="COMPETE WITH FRIENDS"
                body="Weekly volume leaderboards keep your crew honest."
              />
              <Leaderboard />
            </>
          )}
        </Animated.View>
      </GestureDetector>
      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View
              key={s}
              style={[
                styles.dot,
                i === page ? { width: 22, backgroundColor: colors.lime } : { width: 7 },
              ]}
            />
          ))}
        </View>
        <LimeButton label={last ? "GET STARTED" : "NEXT"} onPress={next} />
      </View>
    </SafeAreaView>
  );
}

function Copy({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.copy}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {children}
    </View>
  );
}

function Plate() {
  return (
    <View style={styles.plateWrap}>
      <View style={styles.plateHalo} />
      <View style={styles.plate}>
        <View style={styles.plateHub} />
      </View>
      <View style={[styles.plateEnd, { left: -14 }]} />
      <View style={[styles.plateEnd, { right: -14 }]} />
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

function Voice() {
  return (
    <View style={styles.voiceWrap}>
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

function Leaderboard() {
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
          <Text style={styles.rowName}>{r.name}</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 3 }}>
            <Num size={24} color={r.you ? colors.lime : colors.white}>
              {r.vol}
            </Num>
            <Text style={styles.rowUnit}>t</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: dark.bg },
  slide: {
    flex: 1,
    paddingHorizontal: 26,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 20,
  },
  footer: { paddingHorizontal: 26, paddingBottom: 30, gap: 24 },
  dots: { flexDirection: "row", gap: 7, justifyContent: "center" },
  dot: { height: 7, borderRadius: 99, backgroundColor: colors.whiteA20 },
  copy: { alignItems: "center", gap: 16, marginTop: 46, width: "100%" },
  title: {
    fontFamily: fonts.display,
    fontSize: 42,
    lineHeight: 47,
    color: colors.white,
    letterSpacing: em(42, 0.02),
    textAlign: "center",
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14.5,
    lineHeight: 22,
    color: dark.sub,
    textAlign: "center",
    maxWidth: 290,
  },
  sample: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: dark.field,
    borderWidth: 1,
    borderColor: dark.fieldBorder,
  },
  sampleDot: { width: 6, height: 6, borderRadius: 99, backgroundColor: colors.lime },
  sampleText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.white,
    writingDirection: "rtl",
  },
  plateWrap: { width: 168, height: 168, alignItems: "center", justifyContent: "center" },
  plateHalo: {
    ...StyleSheet.absoluteFill,
    borderRadius: 99,
    borderWidth: 2,
    borderColor: colors.limeA18,
  },
  plate: {
    width: 132,
    height: 132,
    borderRadius: 99,
    borderWidth: 14,
    borderColor: colors.lime,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.lime,
    shadowOpacity: 0.25,
    shadowRadius: 20,
  },
  plateHub: {
    width: 44,
    height: 44,
    borderRadius: 99,
    backgroundColor: dark.bg,
    borderWidth: 3,
    borderColor: colors.whiteA12,
  },
  plateEnd: {
    position: "absolute",
    top: 69,
    width: 28,
    height: 30,
    borderRadius: 6,
    backgroundColor: colors.lime,
  },
  voiceWrap: { width: 168, height: 168, alignItems: "center", justifyContent: "center" },
  ripple: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 99,
    borderWidth: 2,
    borderColor: colors.lime,
  },
  mic: {
    width: 96,
    height: 96,
    borderRadius: 99,
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
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: dark.card,
    borderWidth: 1,
    borderColor: colors.whiteA06,
  },
  rowYou: { backgroundColor: colors.limeA10, borderColor: colors.limeA30 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 99,
    backgroundColor: colors.darkAvatar,
    alignItems: "center",
    justifyContent: "center",
  },
  rowName: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.white },
  rowUnit: { fontFamily: fonts.body, fontSize: 11, color: dark.sub },
});
