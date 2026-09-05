import { Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { colors, radii } from "@/theme/tokens";
import { Icon } from "./Icon";

/**
 * Floating Quick Capture trigger. The design's own copy says Quick Capture is
 * "raised from any screen" but no mock frame shows the trigger itself (it's
 * off-canvas in every screenshot) — this is the minimal, reusable affordance
 * needed to make that described interaction reachable, anchored above the
 * tab bar on every tab screen.
 */
export function FAB({ bottom = 84 }: { bottom?: number }) {
  return (
    <Pressable
      onPress={() => router.push("/capture")}
      style={({ pressed }) => [styles.base, { bottom }, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Quick capture"
    >
      <Icon name="add" size={26} color={colors.textOnDark} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    position: "absolute",
    end: 20,
    width: 54,
    height: 54,
    borderRadius: radii.pill,
    backgroundColor: colors.brandDark,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  pressed: {
    opacity: 0.85,
  },
});
