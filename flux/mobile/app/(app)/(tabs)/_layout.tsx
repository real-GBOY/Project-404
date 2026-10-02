import { Tabs } from "expo-router";
import { FloatingNav } from "@/components/FloatingNav";
import { colors } from "@/theme/tokens";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingNav {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
    >
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="history" options={{ title: "History" }} />
      <Tabs.Screen name="stats" options={{ title: "Stats" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
