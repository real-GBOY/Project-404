import { StyleSheet, View } from "react-native";
import { trackingOf, type Exercise } from "@/features/training/catalog";
import { shapeOf } from "@/features/training/format";
import type { Draft } from "@/features/training/persistence";
import { space } from "@/theme/tokens";
import { Stepper } from "../Stepper";

const KG_STEP = 2.5;

type Props = {
  ex: Exercise;
  draft: Draft;
  onChange: (d: Draft) => void;
  units: { label: string; show: (kg: number) => string };
};

/** Weight + reps steppers, adapted to how the exercise is tracked (reps only, duration …). */
export function InputSteppers({ ex, draft, onChange, units }: Props) {
  const shape = shapeOf(ex);
  const { kg, reps } = draft;
  return (
    <View style={styles.pair}>
      {shape.load ? (
        <Stepper
          label={shape.loadLabel}
          unit={units.label}
          display={units.show(kg)}
          onMinus={() => onChange({ kg: Math.max(0, kg - KG_STEP), reps })}
          onPlus={() => onChange({ kg: kg + KG_STEP, reps })}
        />
      ) : null}
      <Stepper
        label={shape.repsLabel}
        unit={trackingOf(ex) === "time" ? "sec" : undefined}
        display={String(reps)}
        onMinus={() => onChange({ kg, reps: Math.max(shape.repsStep, reps - shape.repsStep) })}
        onPlus={() => onChange({ kg, reps: reps + shape.repsStep })}
      />
    </View>
  );
}

const styles = StyleSheet.create({ pair: { flexDirection: "row", gap: space.md } });
