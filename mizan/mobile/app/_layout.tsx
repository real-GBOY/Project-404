import { useCallback, useEffect, useState } from "react";
import { I18nManager } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { queryClient } from "@/lib/api/query-client";
import { AuthProvider } from "@/lib/auth/auth-provider";
import { initI18n, dirFor, i18n, type Locale } from "@/lib/i18n";
import { colors } from "@/theme/tokens";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const instance = await initI18n();
      // Defensive: I18nManager persists forceRTL natively across restarts, but
      // make sure it actually matches the stored locale before first paint.
      const locale = (instance.resolvedLanguage ?? "en") as Locale;
      const shouldBeRtl = dirFor(locale) === "rtl";
      if (I18nManager.isRTL !== shouldBeRtl) {
        I18nManager.allowRTL(shouldBeRtl);
        I18nManager.forceRTL(shouldBeRtl);
        // Layout direction only fully applies after a native relaunch; the
        // very first cold start after switching already restarts the process,
        // so this just keeps the flag correct — no extra prompt needed here.
      }
      setI18nReady(true);
    })();
  }, []);

  const ready = fontsLoaded && i18nReady;

  const onLayoutRootView = useCallback(async () => {
    if (ready) await SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <I18nextProvider i18n={i18n}>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <StatusBar style="dark" />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="capture" options={{ presentation: "transparentModal", animation: "fade" }} />
                <Stack.Screen name="assistant/index" options={{ presentation: "fullScreenModal" }} />
              </Stack>
            </AuthProvider>
          </QueryClientProvider>
        </I18nextProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
