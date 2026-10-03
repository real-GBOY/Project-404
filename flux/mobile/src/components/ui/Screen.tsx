import type { ReactNode, Ref } from "react";
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, space } from "@/theme/tokens";

type Props = {
  children: ReactNode;
  /** Extra bottom padding so content clears the floating tab bar. */
  tabBarClearance?: boolean;
  gap?: number;
  contentStyle?: StyleProp<ViewStyle>;
  scrollRef?: Ref<ScrollView>;
};

/** Light-theme scrolling screen: safe-area top padding, 20px gutters, optional tab-bar clearance. */
export function Screen({
  children,
  tabBarClearance = false,
  gap = 18,
  contentStyle,
  scrollRef,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          {
            paddingTop: insets.top + 6,
            paddingBottom: tabBarClearance ? 130 + insets.bottom : 30 + insets.bottom,
            paddingHorizontal: space.xl,
            gap,
          },
          contentStyle,
        ]}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.bg } });
