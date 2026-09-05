import { View, Text, StyleSheet } from "react-native";
import { colors, radii } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";

/** The monospace matter-reference chip ("TP-2025-0055") — sand fill, brass
 *  hairline border, Court Navy monospace text (Mizan Identity chip tokens). */
export function MatterRefBadge({ reference, small = false }: { reference: string; small?: boolean }) {
  return (
    <View style={[styles.base, small && styles.small]}>
      <Text style={[styles.text, small && styles.textSmall]}>{reference}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
    backgroundColor: colors.brandCream,
    borderWidth: 1,
    borderColor: colors.brandCreamBorder,
    borderRadius: radii.xs,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  small: {
    borderRadius: radii.xs,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: {
    fontFamily: fontFamily.mono,
    fontWeight: "700",
    fontSize: fontSize.base,
    color: colors.brandAmberBannerText,
  },
  textSmall: {
    fontSize: fontSize.xs,
  },
});
