import { useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Icon, IconButton, Num } from "@/components/ui";
import { Screen } from "@/components/ui/Screen";
import { useSession } from "@/features/auth/session";
import { useTraining } from "@/features/training/store";
import { formatMemberSince } from "@/lib/dates";
import { colors, em, radii, space } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import { PrsPanel } from "./components/PrsPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { soft } from "./components/panelStyles";

export function ProfileScreen() {
  const { user } = useSession();
  const { sessions, prs } = useTraining();
  const scroller = useRef<ScrollView>(null);
  const [settingsY, setSettingsY] = useState(0);

  if (!user) return null;
  const handle = `@${user.name
    .split(/\s+/)[0]!
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")}`;
  const totalVolumeT = Math.round(sessions.reduce((n, s) => n + s.volumeKg, 0) / 1000);
  const stats = [
    { n: String(sessions.length), l: "Sessions" },
    { n: String(totalVolumeT), u: "T", l: "Volume" },
    { n: String(Object.keys(prs).length), l: "Personal Records" },
  ];

  return (
    <Screen tabBarClearance gap={0} scrollRef={scroller}>
      <View style={styles.header}>
        <Text style={styles.title}>PROFILE</Text>
        <IconButton
          label="Settings"
          onPress={() => scroller.current?.scrollTo({ y: settingsY - 20, animated: true })}
        >
          <Icon name="gear" size={19} color={colors.ink} />
        </IconButton>
      </View>

      <View style={{ height: 16 }} />
      <View style={{ alignItems: "center" }}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{user.name.toUpperCase()}</Text>
        <Text style={styles.handle}>{handle}</Text>
        <Text style={styles.since}>Member since {formatMemberSince(new Date(user.joinedAt))}</Text>
      </View>

      <View style={{ height: 22 }} />
      <View style={styles.statRow}>
        {stats.map((s) => (
          <View key={s.l} style={styles.stat}>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 1 }}>
              <Num size={28}>{s.n}</Num>
              {s.u ? (
                <Num size={15} color={colors.sub}>
                  {s.u}
                </Num>
              ) : null}
            </View>
            <Text style={styles.statLabel}>{s.l}</Text>
          </View>
        ))}
      </View>

      <View style={{ height: 22 }} />
      <PrsPanel prs={prs} />

      <View style={{ height: 22 }} onLayout={(e) => setSettingsY(e.nativeEvent.layout.y)} />
      <SettingsPanel />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.ink,
    letterSpacing: em(28, 0.04),
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: radii.pill,
    backgroundColor: colors.lime,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.lime,
    shadowOpacity: 0.4,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  avatarText: { fontFamily: fonts.display, fontSize: 38, color: colors.white, letterSpacing: 0.76 },
  name: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.ink,
    letterSpacing: 0.72,
    marginTop: 12,
  },
  handle: { fontFamily: fonts.body, fontSize: 13, color: colors.sub, marginTop: 3 },
  since: { fontFamily: fonts.body, fontSize: 12, color: colors.sub, marginTop: 2 },
  statRow: { flexDirection: "row", gap: 10 },
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radii.chip,
    paddingTop: 15,
    paddingBottom: 13,
    paddingHorizontal: space.sm,
    alignItems: "center",
    gap: 7,
    ...soft,
  },
  statLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: colors.sub,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    textAlign: "center",
    lineHeight: 12.5,
  },
});
