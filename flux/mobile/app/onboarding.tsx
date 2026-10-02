import { Redirect } from "expo-router";
import { useSession } from "@/features/auth/session";
import { OnboardingScreen } from "@/features/onboarding/screens/OnboardingScreen";

/** Profile onboarding: only for a signed-in account that hasn't finished it. */
export default function Onboarding() {
  const { status } = useSession();
  if (status === "loading") return null;
  if (status === "signedOut") return <Redirect href="/sign-in" />;
  if (status === "ready") return <Redirect href="/home" />;
  return <OnboardingScreen />;
}
