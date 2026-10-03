import { Redirect, Stack } from "expo-router";
import { useSession } from "@/features/auth/session";
import { BuilderDraftProvider } from "@/features/builder/draft";
import { TrainingProvider } from "@/features/training/store";
import { colors } from "@/theme/tokens";

/** The app proper. Signed-out → sign-in; unfinished profile → onboarding. */
export default function AppLayout() {
  const { status, user } = useSession();
  if (status === "loading") return null;
  if (status === "signedOut") return <Redirect href="/sign-in" />;
  if (status === "needsOnboarding" || !user?.profile) return <Redirect href="/onboarding" />;

  return (
    <TrainingProvider
      email={user.email}
      splitId={user.profile.sel.split}
      durationId={user.profile.sel.duration}
    >
      <BuilderDraftProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="workout" options={{ gestureEnabled: false }} />
          <Stack.Screen name="progress" />
          <Stack.Screen name="builder" />
          <Stack.Screen
            name="picker"
            options={{ presentation: "modal", animation: "slide_from_bottom" }}
          />
          <Stack.Screen name="summary" options={{ gestureEnabled: false }} />
          <Stack.Screen
            name="voice"
            options={{
              presentation: "transparentModal",
              animation: "slide_from_bottom",
              contentStyle: { backgroundColor: "transparent" },
            }}
          />
          <Stack.Screen
            name="rest"
            options={{
              presentation: "transparentModal",
              animation: "slide_from_bottom",
              contentStyle: { backgroundColor: "transparent" },
            }}
          />
          <Stack.Screen
            name="pr"
            options={{ presentation: "fullScreenModal", animation: "fade" }}
          />
        </Stack>
      </BuilderDraftProvider>
    </TrainingProvider>
  );
}
