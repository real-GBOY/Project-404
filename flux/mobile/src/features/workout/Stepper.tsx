import { Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Card, Icon, Label, Num } from "@/components/ui";
import { colors, radii } from "@/theme/tokens";

type Props = {
  label: string;
  unit?: string;
  /** Rendered value (already unit-converted). */
  display: string;
  onMinus: () => void;
  onPlus: () => void;
};

export function Stepper({ label, unit, display, onMinus, onPlus }: Props) {
  const btn = (name: "minus" | "plus", fn: () => void, a11y: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        fn();
      }}
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.7 }]}
    >
      <Icon name={name} size={16} color={colors.ink} />
    </Pressable>
  );
  return (
    <Card style={{ flex: 1, paddingTop: 14, paddingHorizontal: 14, paddingBottom: 16 }}>
      <Label size={10}>{label}</Label>
      <View style={styles.row}>
        {btn("minus", onMinus, `Decrease ${label}`)}
        <View style={styles.value}>
          <Num size={32}>{display}</Num>
          {unit ? (
            <Num size={14} color={colors.sub}>
              {unit}
            </Num>
          ) : null}
        </View>
        {btn("plus", onPlus, `Increase ${label}`)}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  value: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  btn: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.stepBtn,
    borderWidth: 1,
    borderColor: colors.hair,
    alignItems: "center",
    justifyContent: "center",
  },
});
