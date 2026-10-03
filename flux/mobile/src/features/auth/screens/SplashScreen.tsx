import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Icon } from "@/components/ui";
import { colors, em } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import { useSession } from "../session";

const MIN_SPLASH_MS = 1700;

/** Launch screen. Waits for storage to hydrate, then routes by session state. */
export function SplashScreen() {
  const router = useRouter();
  const { status, seenIntro } = useSession();

  const x = useSharedValue(-48);
  useEffect(() => {
    x.value = withRepeat(
      withTiming(120, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
    );
  }, [x]);
  const barStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  useEffect(() => {
    if (status === "loading") return;
    const t = setTimeout(() => {
      if (status === "ready") router.replace("/home");
      else if (status === "needsOnboarding") router.replace("/onboarding");
      else router.replace(seenIntro ? "/sign-in" : "/intro");
    }, MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, [status, seenIntro, router]);

  return (
    <View style={styles.root}>
      <Animated.View entering={FadeInDown.duration(900)} style={styles.logoWrap}>
        <View style={styles.badge}>
          <Icon name="dumbbellLogo" size={44} color={colors.lime} />
        </View>
        <Text style={styles.logo}>FLUX</Text>
      </Animated.View>
      <Animated.Text entering={FadeInDown.duration(900).delay(250)} style={styles.tagline}>
        Every rep counts. Every kilo matters.
      </Animated.Text>
      <View style={styles.loader}>
        <Animated.View style={[styles.loaderFill, barStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black, alignItems: "center", justifyContent: "center" },
  logoWrap: { alignItems: "center", gap: 22 },
  badge: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: colors.limeA10,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    fontFamily: fonts.display,
    fontSize: 84,
    lineHeight: 88,
    color: colors.lime,
    letterSpacing: em(84, 0.1),
  },
  tagline: {
    marginTop: 14,
    fontFamily: fonts.body,
    fontSize: 13.5,
    color: colors.whiteA62,
    letterSpacing: 0.54,
  },
  loader: {
    position: "absolute",
    bottom: 70,
    width: 120,
    height: 3,
    borderRadius: 99,
    backgroundColor: colors.whiteA10,
    overflow: "hidden",
  },
  loaderFill: { width: 48, height: "100%", borderRadius: 99, backgroundColor: colors.lime },
});
