import { View } from "react-native";
import { useRouter } from "expo-router";
import { LimeButton } from "@/components/ui";
import { Screen } from "@/components/ui/Screen";
import { useSession } from "@/features/auth/session";
import { useTraining } from "@/features/training/store";
import { HomeHeader } from "./components/HomeHeader";
import { LastSessionCard } from "./components/LastSessionCard";
import { RoutineList } from "./components/RoutineList";
import { StatTiles } from "./components/StatTiles";
import { TodayCard } from "./components/TodayCard";
import { WeekStrip } from "./components/WeekStrip";

/** Home: action first (today's session), then progress, then context. */
export function HomeScreen() {
  const router = useRouter();
  const { user } = useSession();
  const { sessions, prs, todayPlan, workout, startWorkout } = useTraining();
  const now = new Date();

  const done = workout ? workout.exercises.filter((e) => e.sets.length > 0).length : 0;
  const last = sessions[0];

  const begin = () => {
    startWorkout();
    router.push("/workout");
  };

  return (
    <Screen tabBarClearance gap={20}>
      <HomeHeader firstName={user?.name.split(" ")[0] ?? ""} now={now} />
      <WeekStrip sessions={sessions} now={now} />
      <TodayCard plan={todayPlan} done={done} />
      <StatTiles sessions={sessions} prs={prs} now={now} />
      <RoutineList />
      {last ? <LastSessionCard session={last} prs={prs} /> : null}
      <View style={{ marginTop: 2 }}>
        <LimeButton
          label={workout ? "CONTINUE SESSION" : "START SESSION"}
          icon="play"
          iconPosition="left"
          height={58}
          fontSize={24}
          onPress={begin}
        />
      </View>
    </Screen>
  );
}
