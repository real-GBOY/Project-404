import { StyleSheet, View } from "react-native";
import { Card, Icon, Label, Num, type IconName } from "@/components/ui";
import { prsThisWeek, streak, weekVolumeKg } from "@/features/training/metrics";
import type { PersonalRecord, Session } from "@/features/training/types";
import { colors, em, radii, space } from "@/theme/tokens";

type Stat = { num: string; unit?: string; label: string; icon: IconName };

/** Streak, weekly volume and PRs this week. */
export function StatTiles({
  sessions,
  prs,
  now,
}: {
  sessions: Session[];
  prs: Record<string, PersonalRecord>;
  now: Date;
}) {
  const stats: Stat[] = [
    { num: String(streak(sessions, now)), label: "Day Streak", icon: "flame" },
    {
      num: (weekVolumeKg(sessions, now) / 1000).toFixed(1),
      unit: "T",
      label: "Volume",
      icon: "layers",
    },
    { num: String(prsThisWeek(prs, now)), label: "PRs / Week", icon: "trophy" },
  ];
  return (
    <View style={styles.row}>
      {stats.map((s) => (
        <Card key={s.label} style={styles.stat}>
          <View style={styles.icon}>
            <Icon name={s.icon} size={16} color={colors.limeDim} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 1 }}>
            <Num size={30}>{s.num}</Num>
            {s.unit ? (
              <Num size={18} color={colors.sub}>
                {s.unit}
              </Num>
            ) : null}
          </View>
          <Label size={9.5} style={{ letterSpacing: em(9.5, 0.05) }}>
            {s.label}
          </Label>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.md },
  stat: { flex: 1, paddingTop: 14, paddingHorizontal: space.md, paddingBottom: 13, gap: 9 },
  icon: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    backgroundColor: colors.limeTintStrong,
    alignItems: "center",
    justifyContent: "center",
  },
});
