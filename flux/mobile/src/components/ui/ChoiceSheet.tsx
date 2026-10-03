import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, space } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import { Icon } from "./Icon";

type Props<T extends string> = {
  visible: boolean;
  title?: string;
  options: readonly T[];
  value: T;
  onSelect: (v: T) => void;
  onClose: () => void;
};

/** Centered option picker (gender, language, units, history filter). */
export function ChoiceSheet<T extends string>({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
}: Props<T>) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={styles.backdrop}
        onPress={onClose}
      >
        <View style={styles.sheet}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {options.map((o) => (
            <Pressable
              key={o}
              accessibilityRole="radio"
              accessibilityState={{ selected: o === value }}
              onPress={() => {
                onSelect(o);
                onClose();
              }}
              style={styles.option}
            >
              <Text style={[styles.optionText, o === value && styles.optionOn]}>{o}</Text>
              {o === value ? <Icon name="check" size={16} color={colors.limeDim} /> : null}
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.blackA40,
    justifyContent: "center",
    padding: space.xxl,
  },
  sheet: { backgroundColor: colors.card, borderRadius: 18, paddingVertical: 6 },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
    letterSpacing: 0.9,
    paddingHorizontal: space.xl,
    paddingTop: 14,
    paddingBottom: 4,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: space.lg,
    paddingHorizontal: space.xl,
  },
  optionText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
  optionOn: { fontFamily: fonts.bodyBold },
});
