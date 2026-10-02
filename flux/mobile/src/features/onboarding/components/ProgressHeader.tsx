import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Icon } from "@/components/ui";
import { colors } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import { STEP_COUNT } from "../data";

type Props = { step: number; onBack: () => void };

export function ProgressHeader({ step, onBack }: Props) {
  const pct = useSharedValue((step + 1) / STEP_COUNT);
  useEffect(() => {
    pct.value = withTiming((step + 1) / STEP_COUNT, {
      duration: 400,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
  }, [step, pct]);
  const fill = useAnimatedStyle(() => ({ width: `${pct.value * 100}%` }));

  return (
    <View style={styles.row}>
      {step > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={styles.back}
        >
          <Icon name="back" size={18} color={colors.ink} />
        </Pressable>
      ) : (
        <View style={styles.backSpacer} />
      )}
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fill]} />
      </View>
      <Text style={styles.count}>
        Step {step + 1} of {STEP_COUNT}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    height: 42,
    marginHorizontal: 20,
    marginTop: 8,
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hair,
    alignItems: "center",
    justifyContent: "center",
  },
  backSpacer: { width: 38 },
  track: {
    flex: 1,
    height: 4,
    borderRadius: 99,
    backgroundColor: colors.track,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 99, backgroundColor: colors.lime },
  count: {
    width: 62,
    textAlign: "right",
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.sub,
  },
});
