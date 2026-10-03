import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/ui";
import { colors } from "@/theme/tokens";
import { fonts } from "@/theme/typography";

/** The toggle between two exercises that links them as a superset. */
export function SupersetLink({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const line = [styles.line, on && { backgroundColor: colors.lime }];
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel="Superset with next exercise"
      accessibilityState={{ checked: on }}
      onPress={onToggle}
      style={styles.link}
    >
      <View style={line} />
      <Icon name="layers" size={14} color={on ? colors.limeDim : colors.chevron} />
      <Text style={[styles.text, { color: on ? colors.limeDim : colors.muted }]}>
        {on ? "Superset — no rest between" : "Link as superset"}
      </Text>
      <View style={line} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 2,
  },
  line: { width: 20, height: 1, backgroundColor: colors.divider },
  text: { fontFamily: fonts.bodySemi, fontSize: 10.5 },
});
