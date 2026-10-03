import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Card, Label, Num, Ring } from "@/components/ui";
import { useRestRemaining, useTrainingActions } from "@/features/training/store";
import { colors, radii, space } from "@/theme/tokens";
import { fonts } from "@/theme/typography";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * Inline rest timer. It owns the 250 ms clock, so only this card re-renders every tick —
 * not the whole workout screen.
 */
export const RestCard = memo(function RestCard() {
  const router = useRouter();
  const rest = useRestRemaining();
  const { skipRest } = useTrainingActions();
  if (!rest) return null;
  return (
    <Card dark style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open rest timer"
        onPress={() => router.push("/rest")}
        style={styles.open}
      >
        <Ring
          value={rest.total - rest.remaining}
          total={rest.total}
          size={56}
          stroke={5}
          track={colors.whiteA12}
        >
          <Num size={20} color={colors.white}>
            {mmss(rest.remaining)}
          </Num>
        </Ring>
        <View style={{ flex: 1 }}>
          <Label size={10} color={colors.whiteA50}>
            Rest timer
          </Label>
          <Text style={styles.text}>Next set in {rest.remaining}s</Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Skip rest"
        onPress={skipRest}
        style={styles.skip}
      >
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: { padding: space.lg, flexDirection: "row", alignItems: "center", gap: space.lg },
  open: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.lg },
  text: { fontFamily: fonts.body, fontSize: 13, color: colors.white, marginTop: 3 },
  skip: {
    backgroundColor: colors.whiteA10,
    borderRadius: radii.md - 1,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  skipText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.white },
});
