import { StyleSheet, View } from "react-native";
import type { Body, Units } from "../types";
import { GenderField, NumField } from "./BodyFields";
import { space } from "@/theme/tokens";

type Props = { body: Body; setBody: (b: Body) => void; units: Units; setUnits: (u: Units) => void };

export function BodyFieldsGroup({ body, setBody, units, setUnits }: Props) {
  const upd = (k: "age" | "height" | "weight", v: string) => setBody({ ...body, [k]: v });
  return (
    <View style={styles.col}>
      <NumField
        icon="person"
        label="Age"
        value={body.age}
        unit="years"
        onChange={(v) => upd("age", v)}
      />
      <NumField
        icon="ruler"
        label="Height"
        value={body.height}
        toggle={["cm", "ft"] as const}
        toggleValue={units.h}
        onToggle={(h) => setUnits({ ...units, h })}
        onChange={(v) => upd("height", v)}
      />
      <NumField
        icon="scale"
        label="Weight"
        value={body.weight}
        toggle={["kg", "lbs"] as const}
        toggleValue={units.w}
        onToggle={(w) => setUnits({ ...units, w })}
        onChange={(v) => upd("weight", v)}
      />
      <GenderField value={body.gender} onChange={(gender) => setBody({ ...body, gender })} />
    </View>
  );
}

const styles = StyleSheet.create({ col: { paddingHorizontal: space.xl, gap: space.md } });
