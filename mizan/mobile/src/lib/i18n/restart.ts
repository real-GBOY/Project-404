import * as Updates from "expo-updates";
import { Alert } from "react-native";

/**
 * RN only re-flows for RTL on a native relaunch — `setLocale`'s
 * `I18nManager.forceRTL` call takes effect on the next start. `Updates.reloadAsync`
 * restarts the native runtime in a production/EAS build; it isn't available in
 * Expo Go, so fall back to asking the user to close and reopen the app.
 */
export async function restartForDirectionChange(): Promise<void> {
  try {
    await Updates.reloadAsync();
  } catch {
    Alert.alert(
      "Restart required",
      "Close and reopen Mizan to apply the new text direction.",
    );
  }
}
