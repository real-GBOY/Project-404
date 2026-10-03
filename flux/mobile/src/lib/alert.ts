import { Alert as RNAlert, Platform, type AlertButton, type AlertOptions } from "react-native";

/**
 * `Alert.alert` is a no-op on react-native-web. Native behaviour is untouched; on web we ask
 * with window.confirm instead:
 *   - each action button is offered in order ("OK" runs it, "Cancel" moves to the next),
 *   - if none is accepted, the cancel-style button (if any) runs — so a two-button
 *     "Start now / Done" dialog can reach both, and declining everything never destroys data.
 */
export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) {
    if (Platform.OS !== "web") {
      RNAlert.alert(title, message, buttons, options);
      return;
    }
    const text = message ? `${title}\n\n${message}` : title;
    const actions = (buttons ?? []).filter((b) => b.style !== "cancel");
    const cancel = (buttons ?? []).find((b) => b.style === "cancel");
    if (actions.length === 0) {
      window.alert(text);
      cancel?.onPress?.();
      return;
    }
    for (const action of actions) {
      if (window.confirm(`${text}\n\n${action.text}?`)) {
        action.onPress?.();
        return;
      }
    }
    cancel?.onPress?.();
  },
};
