import { Alert as RNAlert, Platform, type AlertButton, type AlertOptions } from "react-native";

/**
 * `Alert.alert` is a no-op on react-native-web, which would leave buttons dead when the app
 * runs in a browser. Native behaviour is untouched; on web we fall back to window.confirm /
 * window.alert, running the first non-cancel button when the user confirms.
 */
export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) {
    if (Platform.OS !== "web") {
      RNAlert.alert(title, message, buttons, options);
      return;
    }
    const text = message ? `${title}\n\n${message}` : title;
    const actions = (buttons ?? []).filter((b) => b.style !== "cancel");
    if (actions.length === 0) {
      window.alert(text);
      return;
    }
    if (window.confirm(`${text}\n\nOK → ${actions[0]!.text}`)) actions[0]!.onPress?.();
  },
};
