import { Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii } from "@/theme/tokens";
import { Icon } from "./Icon";

/**
 * Floating Quick Capture trigger. The design's own copy says Quick Capture is
 * "raised from any screen" but no mock frame shows the trigger itself (it's
 * off-canvas in every screenshot) — this is the minimal, reusable affordance
 * needed to make that described interaction reachable, anchored above the
 * tab bar on every tab screen.
 *
 * Default `bottom` clears the floating pill tab bar (app/(tabs)/_layout.tsx:
 * margin 12 + height 64) with a 16px gap, above the safe area.
 */
export function FAB({ bottom }: { bottom?: number }) {
  const insets = useSafeAreaInsets();
  const resolvedBottom = bottom ?? insets.bottom + 12 + 64 + 16;
  return (
    <Pressable
      onPress={() => router.push("/capture")}
      style={({ pressed }) => [styles.base, { bottom: resolvedBottom }, pressed && styles.pressed]}
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
    width: 52,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.brandDark,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.brandDark,
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  pressed: {
    opacity: 0.85,
  },
});
