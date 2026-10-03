import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii } from "@/theme/tokens";
import { fonts } from "@/theme/typography";

export type TabOption<T extends string> = {
  id: T;
  label: string;
  /** Colours when selected (defaults to ink background, lime text). */
  activeBg?: string;
  activeFg?: string;
};

/** Equal-width segmented tabs — picker tabs, set-type selector. */
export function TabPills<T extends string>({
  options,
  value,
  onChange,
  height = 36,
  radius = 11,
  fontSize = 12.5,
  gap = 8,
  bold = false,
}: {
  options: readonly TabOption<T>[];
  value: T;
  onChange: (id: T) => void;
  height?: number;
  radius?: number;
  fontSize?: number;
  gap?: number;
  bold?: boolean;
}) {
  return (
    <View style={[styles.row, { gap }]} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.id)}
            style={[
              styles.tab,
              { height, borderRadius: radius },
              on && { backgroundColor: o.activeBg ?? colors.ink },
            ]}
          >
            <Text
              style={{
                fontFamily: bold ? fonts.bodyBold : fonts.bodySemi,
                fontSize,
                color: on ? (o.activeFg ?? colors.lime) : colors.sub,
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Rounded filter chip (muscle filters). */
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} filter`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        selected && { backgroundColor: colors.limeTintStrong, borderColor: colors.lime },
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? colors.limeDeep : colors.sub }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  tab: {
    flex: 1,
    backgroundColor: colors.trackLight,
    alignItems: "center",
    justifyContent: "center",
  },
  chip: {
    height: 30,
    paddingHorizontal: 13,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.hair,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 12 },
});
