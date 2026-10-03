import { StyleSheet, Text, View } from "react-native";
import { platesPerSide } from "@/features/training/engine";
import { colors, radii, space } from "@/theme/tokens";
import { fonts } from "@/theme/typography";

/** Plates to load on each side of a 20 kg bar for the weight in the stepper. */
export function PlateRow({
  kg,
  unitShort,
  show,
}: {
  kg: number;
  unitShort: string;
  show: (kg: number) => string;
}) {
  const { plates, bar, remainder } = platesPerSide(kg);
  if (plates.length === 0) {
    return (
      <Text style={styles.text}>
        Bar only · {show(bar)} {unitShort}
      </Text>
    );
  }
  return (
    <View style={styles.row} accessibilityLabel="Plates per side">
      <Text style={styles.text}>Per side:</Text>
      {plates.map((p) => (
        <Text key={p.plate} style={styles.plate}>
          {show(p.plate)}
          <Text style={styles.sub}>
            {unitShort}×{p.count}
          </Text>
        </Text>
      ))}
      <Text style={styles.text}>
        + {show(bar)}
        {unitShort} bar
      </Text>
      {remainder > 0.01 ? (
        <Text style={[styles.text, { color: colors.plateauTitle }]}>
          ({show(remainder)}
          {unitShort} not loadable)
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 2,
  },
  plate: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.ink,
    backgroundColor: colors.trackLight,
    borderRadius: radii.xs,
    paddingVertical: 3,
    paddingHorizontal: space.sm - 1,
    overflow: "hidden",
  },
  sub: { fontFamily: fonts.body, color: colors.sub },
  text: { fontFamily: fonts.body, fontSize: 10.5, color: colors.sub },
});
