import { StyleSheet, Text, View } from "react-native";
import { LimeButton } from "@/components/ui";
import { colors, space } from "@/theme/tokens";
import { fonts } from "@/theme/typography";

/** Route-level error boundary UI (exported as `ErrorBoundary` from the layouts). */
export function ErrorScreen({ error, retry }: { error: Error; retry: () => Promise<void> | void }) {
  return (
    <View style={styles.root} accessibilityRole="alert">
      <Text style={styles.title}>SOMETHING BROKE</Text>
      <Text style={styles.body}>
        FLUX hit an unexpected error. Your logged sets are saved on this device.
      </Text>
      {__DEV__ ? <Text style={styles.detail}>{error.message}</Text> : null}
      <View style={{ width: "100%", marginTop: 24 }}>
        <LimeButton label="TRY AGAIN" icon={null} onPress={() => void retry()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xxl,
  },
  title: { fontFamily: fonts.display, fontSize: 32, color: colors.ink, letterSpacing: 0.96 },
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.sub,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  detail: { fontFamily: fonts.body, fontSize: 11, color: colors.plateauTitle, marginTop: 14 },
});
