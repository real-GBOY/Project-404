import { Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useTranslation } from "react-i18next";

/**
 * The 5 persistent bottom-tab destinations — the only screens in the design
 * that render the tab bar (every other screen, including Case Detail,
 * Hearing, Tasks, Clients, is a full-screen push over this navigator).
 */
// Kept in sync with FAB.tsx's default `bottom` — the FAB floats just above
// this pill, so a change to its height/margin here needs a matching change
// there.
const PILL_MARGIN_BOTTOM = 12;
const PILL_HEIGHT = 64;

export default function TabsLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tab = (icon: IconName, labelKey: string) => ({
    tabBarIcon: ({ color }: { color: ColorValue }) => (
      <Icon name={icon} size={25} color={color as string} />
    ),
    tabBarLabel: ({ focused, color }: { focused: boolean; color: ColorValue }) => (
      <Text
        style={{
          fontFamily: focused ? fontFamily.extrabold : fontFamily.semibold,
          fontSize: fontSize.xs,
          color,
        }}
      >
        {t(labelKey)}
      </Text>
    ),
  });

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandDark,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          position: "absolute",
          left: 20,
          right: 20,
          bottom: insets.bottom + PILL_MARGIN_BOTTOM,
          height: PILL_HEIGHT,
          borderRadius: radii.pill,
          borderTopWidth: 0,
          backgroundColor: colors.surface,
          shadowColor: colors.brandDark,
          shadowOpacity: 0.16,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        },
        tabBarItemStyle: { paddingVertical: 0 },
      }}
    >
      <Tabs.Screen name="today" options={tab("today", "common:tabs.today")} />
      <Tabs.Screen name="cases" options={tab("gavel", "common:tabs.cases")} />
      <Tabs.Screen name="calendar" options={tab("calendar_month", "common:tabs.calendar")} />
      <Tabs.Screen name="files" options={tab("folder_open", "common:tabs.files")} />
      <Tabs.Screen name="more" options={tab("more_horiz", "common:tabs.more")} />
    </Tabs>
  );
}
