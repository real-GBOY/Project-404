import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Icon, Num } from "@/components/ui";
import { useUnits } from "@/features/auth/units";
import { EXERCISES, PROFILE_PR_IDS } from "@/features/training/catalog";
import type { PersonalRecord } from "@/features/training/types";
import { formatMonthYear } from "@/lib/dates";
import { colors, space } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import { panel } from "./panelStyles";

/** "My PRs": the three headline lifts, each linking to its progress screen. */
export function PrsPanel({ prs }: { prs: Record<string, PersonalRecord> }) {
  const router = useRouter();
  const units = useUnits();
  return (
    <>
      <Text style={panel.section}>My PRs</Text>
      <View style={panel.box}>
        {PROFILE_PR_IDS.map((id) => {
          const ex = EXERCISES[id]!;
          const pr = prs[ex.name];
          return (
            <View key={id}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${ex.name} personal record`}
                onPress={() =>
                  router.push({ pathname: "/progress", params: { exercise: ex.name } })
                }
                style={styles.row}
              >
                <View style={styles.trophy}>
                  <Icon name="trophy" size={17} color={colors.limeDim} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{ex.name}</Text>
                  <Text style={styles.date}>{pr ? formatMonthYear(new Date(pr.date)) : "—"}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 3 }}>
                  <Num size={20} color={colors.limeDim}>
                    {units.show(pr?.kg ?? ex.prKg)}
                  </Num>
                  <Text style={styles.unit}>{units.label}</Text>
                </View>
              </Pressable>
              <View style={panel.divider} />
            </View>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="See all personal records"
          onPress={() => router.navigate("/stats")}
          style={styles.seeAll}
        >
          <Text style={styles.seeAllText}>See all PRs</Text>
          <Icon name="arrowRight" size={14} color={colors.limeDim} />
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: 14 },
  trophy: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.limeTintStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
  date: { fontFamily: fonts.body, fontSize: 11, color: colors.sub, marginTop: 1 },
  unit: { fontFamily: fonts.display, fontSize: 13, color: colors.limeDim, letterSpacing: 0.26 },
  seeAll: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingTop: 12,
    paddingBottom: 4,
  },
  seeAllText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.limeDim },
});
