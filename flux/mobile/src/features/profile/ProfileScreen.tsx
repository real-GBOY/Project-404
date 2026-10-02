import { useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Alert } from "@/lib/alert";
import { useRouter } from "expo-router";
import { ChoiceSheet, Icon, IconButton, Num, type IconName } from "@/components/ui";
import { Screen } from "@/components/ui/Screen";
import { useSession, type Language, type WeightUnit } from "@/features/auth/session";
import { EXERCISES, PROFILE_PR_IDS } from "@/features/training/catalog";
import { useTraining } from "@/features/training/store";
import { useUnits } from "@/features/training/units";
import { formatMemberSince, formatMonthYear } from "@/lib/dates";
import { colors, em } from "@/theme/tokens";
import { fonts } from "@/theme/typography";

const LANG_LABEL: Record<Language, string> = { EN: "English", AR: "عربي" };
const LANG_BY_LABEL = { English: "EN", عربي: "AR" } as const;

const soft = {
  shadowColor: "#000",
  shadowOpacity: 0.06,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
} as const;

export function ProfileScreen() {
  const router = useRouter();
  const units = useUnits();
  const { user, settings, updateSettings, signOut } = useSession();
  const { sessions, prs } = useTraining();
  const scroller = useRef<ScrollView>(null);
  const [settingsY, setSettingsY] = useState(0);
  const [sheet, setSheet] = useState<"language" | "units" | null>(null);

  if (!user) return null;
  const initial = user.name.charAt(0).toUpperCase();
  const handle = `@${user.name
    .split(/\s+/)[0]!
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")}`;
  const totalVolumeT = Math.round(sessions.reduce((n, s) => n + s.volumeKg, 0) / 1000);

  const confirmSignOut = () =>
    Alert.alert("Sign out?", "You can sign back in any time.", [
      { text: "Cancel", style: "cancel" },
      // Session flips to signedOut; the (app) route guard redirects to /sign-in.
      { text: "Sign out", style: "destructive", onPress: signOut },
    ]);

  const comingSoon = (what: string) =>
    Alert.alert(`${what} is coming soon`, "That part of the FLUX design isn't built yet.");

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
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.name}>{user.name.toUpperCase()}</Text>
        <Text style={styles.handle}>{handle}</Text>
        <Text style={styles.since}>Member since {formatMemberSince(new Date(user.joinedAt))}</Text>
      </View>

      <View style={{ height: 22 }} />
      <View style={styles.statRow}>
        {[
          { n: String(sessions.length), l: "Sessions" },
          { n: String(totalVolumeT), u: "T", l: "Volume" },
          { n: String(Object.keys(prs).length), l: "Personal Records" },
        ].map((s) => (
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
      <Text style={styles.section}>My PRs</Text>
      <View style={styles.panel}>
        {PROFILE_PR_IDS.map((id, i) => {
          const ex = EXERCISES[id]!;
          const pr = prs[ex.name];
          return (
            <View key={id}>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push({ pathname: "/progress", params: { exercise: ex.name } })
                }
                style={styles.prRow}
              >
                <View style={styles.trophy}>
                  <Icon name="trophy" size={17} color={colors.limeDim} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.prName}>{ex.name}</Text>
                  <Text style={styles.prDate}>{pr ? formatMonthYear(new Date(pr.date)) : "—"}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 3 }}>
                  <Num size={20} color={colors.limeDim}>
                    {units.show(pr?.kg ?? ex.prKg)}
                  </Num>
                  <Text style={styles.prUnit}>{units.label}</Text>
                </View>
              </Pressable>
              <View style={styles.divider} />
            </View>
          );
        })}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.navigate("/stats")}
          style={styles.seeAll}
        >
          <Text style={styles.seeAllText}>See all PRs</Text>
          <Icon name="arrowRight" size={14} color={colors.limeDim} />
        </Pressable>
      </View>

      <View style={{ height: 22 }} onLayout={(e) => setSettingsY(e.nativeEvent.layout.y)} />
      <Text style={styles.section}>Settings</Text>
      <View style={[styles.panel, { paddingTop: 2, paddingBottom: 2 }]}>
        <Row icon="globe" label="Language" onPress={() => setSheet("language")}>
          <Text style={styles.value}>{LANG_LABEL[settings.language]}</Text>
          <Icon name="chevR" size={16} color={colors.chevron} />
        </Row>
        <View style={styles.divider} />
        <Row icon="ruler" label="Units" onPress={() => setSheet("units")}>
          <Text style={styles.value}>{settings.units}</Text>
          <Icon name="chevR" size={16} color={colors.chevron} />
        </Row>
        <View style={styles.divider} />
        <Row icon="bell" label="Notifications">
          <Switch
            value={settings.notifications}
            onValueChange={(v) => updateSettings({ notifications: v })}
            trackColor={{ false: colors.switchOff, true: colors.lime }}
            thumbColor="#fff"
            ios_backgroundColor={colors.switchOff}
          />
        </Row>
        <View style={styles.divider} />
        <Row icon="moon" label="Dark Mode">
          <Switch
            value={false}
            onValueChange={() => comingSoon("Dark mode")}
            trackColor={{ false: colors.switchOff, true: colors.lime }}
            thumbColor="#fff"
            ios_backgroundColor={colors.switchOff}
          />
        </Row>
      </View>

      <View style={{ height: 14 }} />
      <Pressable accessibilityRole="button" onPress={confirmSignOut} style={styles.signOut}>
        <View style={styles.signOutIcon}>
          <Icon name="logout" size={17} color={colors.danger} />
        </View>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>

      <ChoiceSheet
        visible={sheet === "language"}
        title="LANGUAGE"
        options={["English", "عربي"] as const}
        value={LANG_LABEL[settings.language] as "English" | "عربي"}
        onSelect={(label) => {
          updateSettings({ language: LANG_BY_LABEL[label] });
          if (label === "عربي") comingSoon("Arabic");
        }}
        onClose={() => setSheet(null)}
      />
      <ChoiceSheet<WeightUnit>
        visible={sheet === "units"}
        title="UNITS"
        options={["KG", "LBS"]}
        value={settings.units}
        onSelect={(u) => updateSettings({ units: u })}
        onClose={() => setSheet(null)}
      />
    </Screen>
  );
}

function Row({
  icon,
  label,
  onPress,
  children,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  children: ReactNode;
}) {
  const body = (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Icon name={icon} size={17} color={colors.ink} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      {children}
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
      {body}
    </Pressable>
  ) : (
    body
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
    borderRadius: 99,
    backgroundColor: colors.lime,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.lime,
    shadowOpacity: 0.4,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  avatarText: { fontFamily: fonts.display, fontSize: 38, color: "#fff", letterSpacing: 0.76 },
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
    borderRadius: 12,
    paddingTop: 15,
    paddingBottom: 13,
    paddingHorizontal: 8,
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
  section: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.sub,
    letterSpacing: em(11, 0.12),
    textTransform: "uppercase",
    paddingLeft: 2,
  },
  panel: {
    backgroundColor: colors.card,
    borderRadius: 16,
    marginTop: 10,
    paddingTop: 4,
    paddingHorizontal: 16,
    paddingBottom: 12,
    ...soft,
  },
  prRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  trophy: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.limeTintStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  prName: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
  prDate: { fontFamily: fonts.body, fontSize: 11, color: colors.sub, marginTop: 1 },
  prUnit: { fontFamily: fonts.display, fontSize: 13, color: colors.limeDim, letterSpacing: 0.26 },
  divider: { height: 1, backgroundColor: colors.hair },
  seeAll: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingTop: 12,
    paddingBottom: 4,
  },
  seeAllText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.limeDim },
  row: { flexDirection: "row", alignItems: "center", gap: 13, paddingVertical: 13 },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#F3F3F3",
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
  value: { fontFamily: fonts.body, fontSize: 13, color: colors.sub },
  signOut: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 13,
    paddingHorizontal: 2,
  },
  signOutIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(255,68,68,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  signOutText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.danger },
});
