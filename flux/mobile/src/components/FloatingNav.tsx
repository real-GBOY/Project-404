import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "@/components/ui";
import { colors, radii, space } from "@/theme/tokens";

/** The slice of the tab-bar props we use (expo-router doesn't re-export the full type). */
type NavProps = {
  state: { index: number; routes: { name: string }[] };
  navigation: { navigate: (name: string) => void };
};

type Item = { route: "home" | "history" | "stats" | "profile"; icon: IconName; label: string };

const LEFT: Item[] = [
  { route: "home", icon: "home", label: "Home" },
  { route: "history", icon: "history", label: "History" },
];
const RIGHT: Item[] = [
  { route: "stats", icon: "stats", label: "Stats" },
  { route: "profile", icon: "profile", label: "Profile" },
];

/** Glass pill tab bar with the raised lime "+" that opens the Workout Builder. */
export function FloatingNav({ state, navigation }: NavProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const active = state.routes[state.index]?.name;

  const renderItem = (it: Item) => {
    const on = active === it.route;
    return (
      <Pressable
        key={it.route}
        accessibilityRole="tab"
        accessibilityLabel={it.label}
        accessibilityState={{ selected: on }}
        onPress={() => {
          if (!on) navigation.navigate(it.route);
        }}
        style={styles.item}
        hitSlop={6}
      >
        <Icon name={it.icon} size={23} color={on ? colors.lime : colors.tabIdle} />
        <View style={[styles.dot, on && { backgroundColor: colors.lime }]} />
      </Pressable>
    );
  };

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { bottom: Math.max(insets.bottom, 10) + 8, width: Math.min(330, width - 40) },
      ]}
    >
      <View style={styles.pill}>
        <View style={styles.clip}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        </View>
        <View style={styles.row}>
          {LEFT.map(renderItem)}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Build a workout"
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
              router.push("/builder");
            }}
            style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.95 }] }]}
          >
            <Icon name="plus" size={24} color={colors.ink} />
          </Pressable>
          {RIGHT.map(renderItem)}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", alignSelf: "center" },
  pill: {
    height: 66,
    borderRadius: 40,
    backgroundColor: colors.navGlass,
    borderWidth: 1,
    borderColor: colors.whiteA12,
    shadowColor: colors.black,
    shadowOpacity: 0.28,
    shadowRadius: 17,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
    overflow: "visible",
  },
  clip: { ...StyleSheet.absoluteFill, borderRadius: 40, overflow: "hidden" },
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: space.lg,
  },
  item: { width: 48, alignItems: "center", gap: 6 },
  dot: { width: 4, height: 4, borderRadius: radii.pill, backgroundColor: "transparent" },
  fab: {
    width: 54,
    height: 54,
    borderRadius: radii.pill,
    marginTop: -26,
    backgroundColor: colors.lime,
    borderWidth: 5,
    borderColor: colors.navRing,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.lime,
    shadowOpacity: 0.5,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
});
