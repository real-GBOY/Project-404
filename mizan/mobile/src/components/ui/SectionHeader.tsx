import { View, Text, StyleSheet } from "react-native";
import { colors } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";

/** The uppercase bronze/gray label + hairline rule pattern that introduces
 *  every card group in the design (e.g. "NEXT HEARING", "OPEN DEADLINES"). */
export function SectionHeader({
  label,
  withRule = false,
  tone = "default",
}: {
  label: string;
  /** the Today screen's section headers add a trailing hairline; list-group
   *  headers elsewhere (Tasks, Files, Clients) don't. */
  withRule?: boolean;
  tone?: "default" | "danger";
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, tone === "danger" && styles.labelDanger]}>{label}</Text>
      {withRule ? <View style={styles.rule} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 9,
  },
  label: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.sm,
    letterSpacing: 0.9,
    color: colors.textSecondary,
    textTransform: "uppercase",
  },
  labelDanger: {
    color: colors.dangerText,
  },
  rule: {
    height: 1,
    flex: 1,
    backgroundColor: colors.borderSectionRule,
  },
});
