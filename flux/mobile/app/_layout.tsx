import { useCallback } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { BebasNeue_400Regular } from "@expo-google-fonts/bebas-neue";
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import { SessionProvider } from "@/features/auth/session";
import { colors } from "@/theme/tokens";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/**
 * Route map
 *   /                 animated splash → routes by session state
 *   (auth)/           intro → sign-up | sign-in            (signed out only)
 *   onboarding        7-step training profile              (signed in, profile unfinished)
 *   (app)/(tabs)/     home · history · stats · profile     (floating tab bar, "+" starts a workout)
 *   (app)/workout     active workout → voice · rest sheets, pr celebration, progress
 */
export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BebasNeue_400Regular,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: colors.bg }}
      onLayout={onLayoutRootView}
    >
      <SafeAreaProvider>
        <SessionProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
              animation: "fade",
            }}
          >
            <Stack.Screen
              name="index"
              options={{ contentStyle: { backgroundColor: colors.black } }}
            />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
            <Stack.Screen name="(app)" />
          </Stack>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
