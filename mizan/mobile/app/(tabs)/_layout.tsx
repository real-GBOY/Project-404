import { Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";
import { colors } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useTranslation } from "react-i18next";

/**
 * The 5 persistent bottom-tab destinations — the only screens in the design
 * that render the tab bar (every other screen, including Case Detail,
 * Hearing, Tasks, Clients, is a full-screen push over this navigator).
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  const tab = (icon: IconName, labelKey: string) => ({
    tabBarIcon: ({ color }: { color: ColorValue }) => <Icon name={icon} size={25} color={color as string} />,
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
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 56,
          paddingTop: 9,
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
