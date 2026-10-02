import { Redirect, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSession } from "@/features/auth/session";
import { dark } from "@/theme/tokens";

/** Signed-out area: intro → sign-up / sign-in. Signed-in users never see it. */
export default function AuthLayout() {
  const { status } = useSession();
  if (status === "loading") return null;
  if (status === "needsOnboarding") return <Redirect href="/onboarding" />;
  if (status === "ready") return <Redirect href="/home" />;
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: dark.bg } }}>
        <Stack.Screen name="intro" options={{ gestureEnabled: false }} />
      </Stack>
    </>
  );
}
