import { View, Text, StyleSheet } from "react-native";
import { colors, radii } from "@/theme/tokens";
import { fontFamily } from "@/theme/typography";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Rounded-square initials avatar — the "AT"/"AS"/"ES" tiles used for
 *  people/clients/team, and the round variant for the header profile chip. */
export function Avatar({
  name,
  size = 38,
  round = false,
  dark = false,
}: {
  name: string;
  size?: number;
  round?: boolean;
  dark?: boolean;
}) {
  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: round ? radii.pill : radii.md,
          backgroundColor: dark ? colors.brandTan : colors.brandCream,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          { fontSize: Math.max(11, size * 0.34), color: dark ? colors.brandDark : colors.brandDeep },
        ]}
      >
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontFamily: fontFamily.extrabold,
  },
});
