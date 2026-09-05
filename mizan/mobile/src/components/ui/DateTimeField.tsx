import { useState } from "react";
import { Platform, Pressable, Text, View, StyleSheet } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { colors, radii } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";
import { formatDateTime } from "@/lib/format";
import { Icon } from "./Icon";

export function DateTimeField({
  value,
  onChange,
  label,
  mode = "datetime",
}: {
  value: Date | null;
  onChange: (d: Date) => void;
  label: string;
  mode?: "date" | "datetime";
}) {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState<"date" | "time">("date");

  const handle = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === "dismissed") {
      setShow(false);
      setStep("date");
      return;
    }
    if (!selected) return;
    if (mode === "datetime" && step === "date" && Platform.OS === "android") {
      onChange(selected);
      setStep("time");
      return;
    }
    onChange(selected);
    setShow(false);
    setStep("date");
  };

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.field} onPress={() => setShow(true)}>
        <Text style={[styles.value, !value && styles.placeholder]}>
          {value ? formatDateTime(value) : "—"}
        </Text>
        <Icon name="event" size={20} color={colors.brandBronze} />
      </Pressable>
      {show ? (
        <DateTimePicker
          value={value ?? new Date()}
          mode={Platform.OS === "android" && mode === "datetime" ? step : mode}
          onChange={handle}
          display={Platform.OS === "ios" ? "inline" : "default"}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.sm,
    letterSpacing: 0.6,
    color: colors.textSecondary,
    textTransform: "uppercase",
    marginBottom: 7,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 13,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  value: { flex: 1, fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.textPrimary },
  placeholder: { color: colors.textSecondary },
});
