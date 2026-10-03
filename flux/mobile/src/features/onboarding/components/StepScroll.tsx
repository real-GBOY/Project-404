import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, space } from "@/theme/tokens";
import { fonts } from "@/theme/typography";

export function StepHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={styles.head}>
      <Text style={styles.title}>{title}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

/** Scrollable body of a step; the NEXT button lives outside it. */
export function StepScroll({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: 10 },
  head: { paddingHorizontal: space.xl, paddingTop: 14, paddingBottom: 16 },
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    color: colors.ink,
    letterSpacing: 0.6,
    lineHeight: 33,
  },
  sub: { fontFamily: fonts.body, fontSize: 13, color: colors.sub, marginTop: 8, lineHeight: 18 },
});
