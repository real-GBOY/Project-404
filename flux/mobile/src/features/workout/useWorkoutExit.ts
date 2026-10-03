import { useCallback, useRef } from "react";
import { BackHandler } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Alert } from "@/lib/alert";
import { useTrainingActions } from "@/features/training/store";

/**
 * Every way out of the workout screen: finish → summary, pause, discard, and the Android
 * back button. `leaving` tells the screen not to bounce back to Home while it is navigating
 * away (finishing clears the workout before the summary route is on screen).
 */
export function useWorkoutExit(totalSets: number) {
  const router = useRouter();
  const { discardWorkout, finishWorkout } = useTrainingActions();
  const leaving = useRef(false);

  const leave = useCallback(() => {
    leaving.current = true;
    if (router.canGoBack()) router.back();
    else router.replace("/home");
  }, [router]);

  const finish = useCallback(() => {
    if (totalSets === 0) {
      Alert.alert("Nothing logged", "Log at least one set before finishing.");
      return;
    }
    leaving.current = true;
    const saved = finishWorkout();
    if (saved) router.replace("/summary");
    else leave();
  }, [totalSets, finishWorkout, leave, router]);

  const confirmExit = useCallback(() => {
    if (totalSets === 0) {
      discardWorkout();
      leave();
      return true;
    }
    Alert.alert(
      "Leave workout?",
      "Your logged sets are safe until you decide.",
      [
        { text: "Finish & save", onPress: finish },
        { text: "Pause — resume later", onPress: leave },
        {
          text: "Discard workout",
          style: "destructive",
          onPress: () => {
            discardWorkout();
            leave();
          },
        },
      ],
      { cancelable: true },
    );
    return true;
  }, [totalSets, discardWorkout, leave, finish]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", confirmExit);
      return () => sub.remove();
    }, [confirmExit]),
  );

  return { leaving, finish, confirmExit };
}
