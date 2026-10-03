import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Num } from "@/components/ui";
import { trainedOn } from "@/features/training/metrics";
import type { Session } from "@/features/training/types";
import { addDays, isSameDay, startOfWeek, weekdayName, WEEKDAY_SHORT } from "@/lib/dates";
import { colors, radii } from "@/theme/tokens";
import { fonts } from "@/theme/typography";

/** Monday-first week row; a dot marks days that have a session. */
export function WeekStrip({ sessions, now }: { sessions: Session[]; now: Date }) {
  const week = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(now), i));
  const [selected, setSelected] = useState(() => week.findIndex((d) => isSameDay(d, now)));
  return (
    <View style={styles.week}>
      {week.map((day, i) => {
        const active = i === selected;
        const trained = trainedOn(sessions, day);
        return (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={`${weekdayName(day)} ${day.getDate()}${trained ? ", trained" : ""}`}
            accessibilityState={{ selected: active }}
            onPress={() => setSelected(i)}
            style={styles.day}
          >
            <Text style={[styles.letter, { color: active ? colors.ink : colors.sub }]}>
              {WEEKDAY_SHORT[i]}
            </Text>
            <View style={[styles.circle, active && styles.circleOn]}>
              <Num size={18} color={active || trained ? colors.ink : colors.sub} style={styles.num}>
                {day.getDate()}
              </Num>
            </View>
            <View style={[styles.dot, !trained && { opacity: 0 }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  week: { flexDirection: "row", justifyContent: "space-between", gap: 6 },
  day: { flex: 1, alignItems: "center", gap: 6 },
  letter: { fontFamily: fonts.bodyMedium, fontSize: 11 },
  circle: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hair,
    alignItems: "center",
    justifyContent: "center",
  },
  // Bebas Neue caps sit ~0.05em above the line-box centre; nudge so digits centre optically
  num: { position: "relative", top: 1, textAlign: "center" },
  circleOn: {
    backgroundColor: colors.lime,
    borderColor: colors.lime,
    shadowColor: colors.limeDim,
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  dot: { width: 5, height: 5, borderRadius: radii.pill, backgroundColor: colors.limeDim },
});
