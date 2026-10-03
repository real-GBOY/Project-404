import { useCallback, useState } from "react";
import { BackHandler, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import Animated, { FadeInLeft, FadeInRight } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/theme/tokens";
import { ProgressHeader } from "../components/ProgressHeader";
import { EQUIPMENT, EXPERIENCE, GOALS, SPLITS, STEP_COUNT } from "../data";
import { DEFAULT_PROFILE } from "@/features/auth/profile";
import { useSession } from "@/features/auth/session";
import type { Body, Selection, Units } from "../types";
import { StepBody, StepFrequency, StepReview, StepSelect } from "./Steps";

const INITIAL_SELECTION: Selection = DEFAULT_PROFILE.sel;
const INITIAL_BODY: Body = DEFAULT_PROFILE.body;
const INITIAL_UNITS: Units = DEFAULT_PROFILE.units;

export function OnboardingScreen() {
  const { completeOnboarding } = useSession();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<"next" | "back">("next");
  const [sel, setSel] = useState(INITIAL_SELECTION);
  const [body, setBody] = useState(INITIAL_BODY);
  const [units, setUnits] = useState(INITIAL_UNITS);

  const set = <K extends keyof Selection>(k: K, v: Selection[K]) =>
    setSel((s) => ({ ...s, [k]: v }));
  const go = useCallback((d: "next" | "back") => {
    setDir(d);
    setStep((s) => Math.min(STEP_COUNT - 1, Math.max(0, d === "next" ? s + 1 : s - 1)));
  }, []);
  const next = () => go("next");

  // Android hardware back steps through the flow before leaving it.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (step === 0) return false;
        go("back");
        return true;
      });
      return () => sub.remove();
    }, [step, go]),
  );

  // Finishing flips the session to "ready"; the route guard then moves us to Home.
  const finish = () => completeOnboarding({ sel, body, units });

  const entering = (dir === "next" ? FadeInRight : FadeInLeft).duration(320);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ProgressHeader step={step} onBack={() => go("back")} />
      <Animated.View key={step} entering={entering} style={styles.body}>
        {step === 0 && (
          <StepSelect
            title="WHAT'S YOUR GOAL?"
            sub="We'll build your program around this"
            items={GOALS}
            value={sel.goal}
            onPick={(v) => set("goal", v)}
            onNext={next}
          />
        )}
        {step === 1 && (
          <StepSelect
            title="HOW LONG HAVE YOU BEEN TRAINING?"
            items={EXPERIENCE}
            value={sel.exp}
            onPick={(v) => set("exp", v)}
            onNext={next}
          />
        )}
        {step === 2 && (
          <StepSelect
            title="CHOOSE YOUR TRAINING SPLIT"
            sub="We'll create your workout templates automatically"
            items={SPLITS}
            value={sel.split}
            onPick={(v) => set("split", v)}
            onNext={next}
          />
        )}
        {step === 3 && (
          <StepSelect
            title="WHAT EQUIPMENT DO YOU HAVE?"
            items={EQUIPMENT}
            value={sel.equip}
            onPick={(v) => set("equip", v)}
            onNext={next}
          />
        )}
        {step === 4 && <StepFrequency sel={sel} set={set} onNext={next} />}
        {step === 5 && (
          <StepBody body={body} setBody={setBody} units={units} setUnits={setUnits} onNext={next} />
        )}
        {step === 6 && <StepReview sel={sel} body={body} units={units} onFinish={finish} />}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
});
