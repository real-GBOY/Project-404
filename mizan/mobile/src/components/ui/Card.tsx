import { View, type ViewProps, StyleSheet } from "react-native";
import { colors, radii } from "@/theme/tokens";

export interface CardProps extends ViewProps {
  /** matches the design's context-dependent radii (16 list cards, 18 grouped
   *  cards, 20 hero/summary cards). */
  radius?: keyof typeof radii;
  padded?: boolean;
}

export function Card({ radius = "lgXl", padded = true, style, children, ...rest }: CardProps) {
  return (
    <View
      style={[
        styles.base,
        { borderRadius: radii[radius] },
        padded && styles.padded,
        style,
      ]}
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
