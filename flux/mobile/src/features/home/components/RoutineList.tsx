import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Card, Icon, Label } from "@/components/ui";
import { useTraining } from "@/features/training/store";
import { Alert } from "@/lib/alert";
import { colors, space } from "@/theme/tokens";
import { fonts } from "@/theme/typography";

/** Workouts saved from the Builder; tapping one starts it. */
export function RoutineList() {
  const router = useRouter();
  const { routines, workout, startRoutine } = useTraining();
  if (routines.length === 0) return null;

  const start = (id: string) => {
    const r = routines.find((x) => x.id === id);
    if (!r) return;
    if (workout) {
      Alert.alert("Workout in progress", "Finish or discard it before starting another.");
      return;
    }
    const ids = r.items.map((i) => i.id);
    if (startRoutine(r.name, ids, r.linked ?? {})) router.push("/workout");
  };

  return (
    <View>
      <Label color={colors.ink} size={11} weight="semi">
        Your workouts
      </Label>
      <View style={styles.list}>
        {routines.slice(0, 4).map((r) => (
          <Card key={r.id} style={styles.card} onPress={() => start(r.id)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{r.name}</Text>
              <Text style={styles.meta}>
                {r.items.length} exercises · {r.items.reduce((n, i) => n + i.sets, 0)} sets
              </Text>
            </View>
            <Icon name="play" size={16} color={colors.limeDeep} />
          </Card>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10, marginTop: 10 },
  card: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg },
  name: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink },
  meta: { fontFamily: fonts.body, fontSize: 11.5, color: colors.sub, marginTop: 2 },
});
