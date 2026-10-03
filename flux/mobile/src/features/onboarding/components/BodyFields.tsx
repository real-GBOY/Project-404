import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ChoiceSheet, Icon, type IconName } from "@/components/ui";
import { colors, radii, space } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import { GENDERS } from "../data";
import type { Gender } from "../types";
import { cardShadow } from "./SelectCard";

type NumFieldProps<T extends string> = {
  icon: IconName;
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit?: string;
  toggle?: readonly T[];
  toggleValue?: T;
  onToggle?: (v: T) => void;
};

export function NumField<T extends string>({
  icon,
  label,
  value,
  onChange,
  unit,
  toggle,
  toggleValue,
  onToggle,
}: NumFieldProps<T>) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={[styles.field, focus && { borderColor: colors.lime }]}>
      <View style={styles.chip}>
        <Icon name={icon} size={19} color={colors.chipIcon} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          value={value}
          onChangeText={(t) => onChange(t.replace(/[^0-9.]/g, ""))}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          keyboardType="decimal-pad"
          maxLength={6}
          selectionColor={colors.limeDim}
          accessibilityLabel={label}
          style={styles.input}
        />
      </View>
      {toggle ? (
        <View style={styles.segment}>
          {toggle.map((t) => {
            const on = t === toggleValue;
            return (
              <Pressable
                key={t}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => onToggle?.(t)}
                style={[styles.seg, on && { backgroundColor: colors.lime }]}
              >
                <Text style={[styles.segText, on && { color: colors.ink }]}>{t}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Text style={styles.unit}>{unit}</Text>
      )}
    </View>
  );
}

export function GenderField({ value, onChange }: { value: Gender; onChange: (v: Gender) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Gender, ${value}`}
        onPress={() => setOpen(true)}
        style={styles.field}
      >
        <View style={styles.chip}>
          <Icon name="body" size={19} color={colors.chipIcon} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.label}>Gender</Text>
          <Text style={styles.select}>{value}</Text>
        </View>
        <Icon name="chevR" size={16} color={colors.chevron} />
      </Pressable>
      <ChoiceSheet
        visible={open}
        options={GENDERS}
        value={value}
        onSelect={onChange}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.hair,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    ...cardShadow,
  },
  chip: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    backgroundColor: colors.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontFamily: fonts.body, fontSize: 11, color: colors.sub, letterSpacing: 0.44 },
  input: {
    fontFamily: fonts.display,
    fontSize: 30,
    color: colors.ink,
    letterSpacing: 0.6,
    padding: 0,
    marginTop: 1,
    height: 34,
  },
  unit: { fontFamily: fonts.body, fontSize: 13, color: colors.sub },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.segment,
    borderRadius: radii.sm,
    padding: 2,
  },
  seg: {
    minWidth: 34,
    height: 28,
    borderRadius: radii.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  segText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.sub },
  select: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink, marginTop: 3 },
});
