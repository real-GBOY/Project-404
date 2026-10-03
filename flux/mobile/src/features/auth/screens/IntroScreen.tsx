import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import Animated, { FadeInLeft, FadeInRight } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { LimeButton } from "@/components/ui";
import { colors, dark, em, radii, space } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import { useSession } from "../session";
import { Leaderboard, Plate, Voice } from "./IntroIllustrations";

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
  dot: { height: 7, borderRadius: radii.pill, backgroundColor: colors.whiteA20 },
  copy: { alignItems: "center", gap: space.lg, marginTop: 46, width: "100%" },
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
    paddingVertical: space.md,
    paddingHorizontal: 18,
    borderRadius: radii.lg,
    backgroundColor: dark.field,
    borderWidth: 1,
    borderColor: dark.fieldBorder,
  },
  sampleDot: { width: 6, height: 6, borderRadius: radii.pill, backgroundColor: colors.lime },
  sampleText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.white,
    writingDirection: "rtl",
  },
});
