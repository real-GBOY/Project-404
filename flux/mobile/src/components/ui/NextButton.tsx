import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ReactNode } from "react";
import { colors } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import { Icon } from "./Icon";

type Props = { label?: string; onPress: () => void; footer?: ReactNode };

/** Lime CTA pinned to the bottom of each onboarding step. */
export function NextButton({ label = "NEXT", onPress, footer }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) + 14 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
          onPress();
        }}
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
      >
        <Text style={styles.label}>{label}</Text>
        <Icon name="arrowRight" size={18} color={colors.ink} />
      </Pressable>
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 14 },
  btn: {
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.lime,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 11,
    shadowColor: colors.lime,
    shadowOpacity: 0.4,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  label: { fontFamily: fonts.display, fontSize: 23, color: colors.ink, letterSpacing: 2.8 },
});
