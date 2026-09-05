import { View, TextInput, StyleSheet } from "react-native";
import { colors, radii } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";
import { Icon } from "./Icon";

export function SearchBar({
  placeholder,
  value,
  onChangeText,
}: {
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
}) {
  return (
    <View style={styles.wrap}>
      <Icon name="search" size={20} color={colors.placeholderIcon} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: colors.bgSunk,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.mdLg,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  input: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
    padding: 0,
  },
});
