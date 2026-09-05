import { View, Text, StyleSheet } from "react-native";
import { colors } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";

/** The uppercase Slate micro-label (12 / 0.2em) + hairline rule that
 *  introduces every card group (e.g. "NEXT HEARING", "OPEN DEADLINES").
 *  Mizan Identity §04: labels are Slate Blue, Public Sans. */
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
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.smMd,
    letterSpacing: 1.4,
    color: colors.brandBronzeLabel,
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
