import { View, type ViewProps, StyleSheet } from "react-native";
import { colors, radii } from "@/theme/tokens";

export interface CardProps extends ViewProps {
  /** institutional radius from `theme/tokens` — all ≤ 8px in the Mizan
   *  Identity system; surfaces are never pill-shaped. */
  radius?: keyof typeof radii;
  padded?: boolean;
}

export function Card({ radius = "lgXl", padded = true, style, children, ...rest }: CardProps) {
  return (
    <View
      style={[styles.base, { borderRadius: radii[radius] }, padded && styles.padded, style]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  padded: {
    padding: 15,
  },
});
