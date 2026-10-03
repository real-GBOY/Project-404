import { StyleSheet } from "react-native";
import { colors, em, radii, space } from "@/theme/tokens";
import { fonts } from "@/theme/typography";

export const soft = {
  shadowColor: colors.black,
  shadowOpacity: 0.06,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
} as const;

/** Section caption + white rounded panel shared by the PR and settings blocks. */
export const panel = StyleSheet.create({
  section: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.sub,
    letterSpacing: em(11, 0.12),
    textTransform: "uppercase",
    paddingLeft: 2,
  },
  box: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    marginTop: 10,
    paddingTop: 4,
    paddingHorizontal: space.lg,
    paddingBottom: 12,
    ...soft,
  },
  divider: { height: 1, backgroundColor: colors.hair },
});
