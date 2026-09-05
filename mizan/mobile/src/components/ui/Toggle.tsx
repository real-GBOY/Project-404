import { useRef, useEffect } from "react";
import { Pressable, View, StyleSheet, Animated } from "react-native";
import { colors, radii } from "@/theme/tokens";
import { useDir } from "@/lib/i18n/use-dir";

const WIDTH = 46;
const HEIGHT = 28;
const KNOB = 22;
const PAD = 3;

/** The pill switch used in Log Time (billable), Expense (recharge to
 *  client), and Settings (Face ID). RTL-mirrored (knob starts opposite side). */
export function Toggle({ value, onValueChange }: { value: boolean; onValueChange: (v: boolean) => void }) {
  const { isRtl } = useDir();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: value ? 1 : 0, duration: 150, useNativeDriver: false }).start();
  }, [value, anim]);

  const travel = WIDTH - KNOB - PAD * 2;
  const translate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: isRtl ? [0, -travel] : [0, travel],
  });

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      hitSlop={8}
    >
      <View style={[styles.track, { backgroundColor: value ? colors.brandDark : colors.borderNeutral }]}>
        <Animated.View style={[styles.knob, { transform: [{ translateX: translate }] }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: WIDTH,
    height: HEIGHT,
    borderRadius: radii.pill,
    padding: PAD,
    justifyContent: "center",
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
  },
});
