import { StyleSheet, Text, View } from "react-native";
import { Card, Label, Num, Ring } from "@/components/ui";
import type { DayPlan } from "@/features/training/plan";
import { colors, em, radii, space } from "@/theme/tokens";
import { fonts } from "@/theme/typography";

/** Dark "Today's Session" card with progress ring and per-exercise segments. */
export function TodayCard({ plan, done }: { plan: DayPlan; done: number }) {
  const total = plan.exercises.length;
  return (
    <Card dark style={{ padding: space.xl, overflow: "hidden" }}>
      <View style={styles.ring}>
        <Ring value={done} total={total} size={58} stroke={5}>
          <View style={{ flexDirection: "row", alignItems: "baseline" }}>
            <Num size={24} color={colors.white}>
              {done}
            </Num>
            <Text style={styles.ringTotal}>/{total}</Text>
          </View>
        </Ring>
      </View>
      <Label color={colors.whiteA45} size={10}>
        Today's Session
      </Label>
      <Text style={styles.name}>{plan.name}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>{total} exercises</Text>
        <View style={styles.metaDot} />
        <Text style={styles.meta}>{plan.minutes} min</Text>
      </View>
      <View style={styles.segments}>
        {plan.exercises.map((e, i) => (
          <View
            key={e.id}
            style={[styles.segment, { backgroundColor: i < done ? colors.lime : colors.whiteA14 }]}
          />
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  ring: { position: "absolute", top: 18, right: 18 },
  ringTotal: { fontFamily: fonts.body, fontSize: 11, color: colors.whiteA50, marginLeft: 1 },
  name: {
    fontFamily: fonts.display,
    fontSize: 38,
    lineHeight: 40,
    color: colors.white,
    letterSpacing: em(38, 0.02),
    marginTop: 8,
    marginBottom: 4,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  meta: { fontFamily: fonts.body, fontSize: 12.5, color: colors.whiteA55 },
  metaDot: { width: 3, height: 3, borderRadius: radii.pill, backgroundColor: colors.whiteA35 },
  segments: { marginTop: 16, flexDirection: "row", gap: 6 },
  segment: { flex: 1, height: 4, borderRadius: radii.pill },
});
