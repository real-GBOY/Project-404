import { Alert } from "react-native";

/**
 * A handful of "+" affordances in the design (new case, new task, new
 * calendar event) have no corresponding create-screen anywhere in the 18
 * designed screens — building one would mean inventing a layout that isn't
 * in the source of truth. Rather than a silent no-op, tapping them says so.
 */
export function notAvailableYet(title: string) {
  Alert.alert(title, "This isn't part of the current design yet.");
}
