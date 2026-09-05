import { Stack } from "expo-router";

export default function CaptureLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "transparent" },
      }}
    >
      <Stack.Screen name="index" options={{ animation: "none" }} />
      <Stack.Screen name="log-time" options={{ presentation: "card", contentStyle: { backgroundColor: "#F7F3EF" } }} />
      <Stack.Screen name="expense" options={{ presentation: "card", contentStyle: { backgroundColor: "#F7F3EF" } }} />
    </Stack>
  );
}
