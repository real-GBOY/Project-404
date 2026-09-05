import type { ReactNode } from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/tokens";

/** The bottom action bar pinned above the home indicator — Case Detail's
 *  Log time/camera/note row, Log Time's Save, Expense's Confirm, etc. */
export function StickyFooterBar({ children, gap = 10 }: { children: ReactNode; gap?: number }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12), gap }]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
});
