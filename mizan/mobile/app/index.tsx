import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/lib/auth/use-auth";
import { colors } from "@/theme/tokens";

/** Auth gate — the actual root of the app; routes to sign-in or the tab
 *  navigator once the session bootstrap (see AuthProvider) resolves. */
export default function Index() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.brandDark} />
      </View>
    );
  }

  return <Redirect href={status === "authed" ? "/(tabs)/today" : "/(auth)/sign-in"} />;
}
