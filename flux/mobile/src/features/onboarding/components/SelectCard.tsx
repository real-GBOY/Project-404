import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Icon } from "@/components/ui";
import { colors } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import type { Option } from "../types";

type Props = { item: Option; selected: boolean; onPress: () => void };

export function SelectCard({ item, selected, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      style={[styles.card, selected && styles.cardOn]}
    >
      <View style={[styles.icon, selected && styles.iconOn]}>
        <Icon name={item.icon} size={22} color={selected ? colors.ink : colors.chipIcon} />
      </View>
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
          {item.badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.badge}</Text>
            </View>
          ) : null}
        </View>
        {item.sub ? <Text style={styles.sub}>{item.sub}</Text> : null}
      </View>
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected ? <Icon name="check" size={14} color={colors.ink} /> : null}
      </View>
    </Pressable>
  );
}

export const cardShadow = {
  shadowColor: colors.black,
  shadowOpacity: 0.05,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
} as const;

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hair,
    borderLeftWidth: 3,
    borderLeftColor: "transparent",
    borderRadius: 16,
    paddingVertical: 15,
    paddingRight: 15,
    paddingLeft: 14,
    ...cardShadow,
  },
  cardOn: {
    backgroundColor: colors.limeTint,
    borderColor: colors.limeBorder,
    borderLeftColor: colors.lime,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  iconOn: { backgroundColor: colors.lime },
  text: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.ink,
    letterSpacing: 0.54,
    flexShrink: 1,
  },
  badge: {
    backgroundColor: colors.lime,
    borderRadius: 99,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: colors.ink,
    letterSpacing: 0.36,
    textTransform: "uppercase",
  },
  sub: { fontFamily: fonts.body, fontSize: 12, color: colors.sub, marginTop: 2 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 99,
    borderWidth: 2,
    borderColor: colors.radio,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: colors.lime, backgroundColor: colors.lime },
});
