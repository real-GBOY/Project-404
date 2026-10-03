import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { ChoiceSheet, Icon, type IconName } from "@/components/ui";
import { useSession, type Language, type WeightUnit } from "@/features/auth/session";
import { Alert } from "@/lib/alert";
import { colors } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import { panel } from "./panelStyles";

const LANG_LABEL: Record<Language, string> = { EN: "English", AR: "عربي" };
const LANG_BY_LABEL = { English: "EN", عربي: "AR" } as const;

const comingSoon = (what: string) =>
  Alert.alert(`${what} is coming soon`, "That part of the FLUX design isn't built yet.");

const Divider = () => <View style={panel.divider} />;

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

const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <Switch
    value={value}
    onValueChange={onChange}
    trackColor={{ false: colors.switchOff, true: colors.lime }}
    thumbColor={colors.white}
    ios_backgroundColor={colors.switchOff}
  />
);

/** Language, units, notifications, dark-mode stub, and sign out. */
export function SettingsPanel() {
  const { settings, updateSettings, signOut } = useSession();
  const [sheet, setSheet] = useState<"language" | "units" | null>(null);

  const confirmSignOut = () =>
    Alert.alert("Sign out?", "You can sign back in any time.", [
      { text: "Cancel", style: "cancel" },
      // Session flips to signedOut; the (app) route guard redirects to /sign-in.
      { text: "Sign out", style: "destructive", onPress: signOut },
    ]);

  return (
    <>
      <Text style={panel.section}>Settings</Text>
      <View style={[panel.box, { paddingTop: 2, paddingBottom: 2 }]}>
        <Row icon="globe" label="Language" onPress={() => setSheet("language")}>
          <Text style={styles.value}>{LANG_LABEL[settings.language]}</Text>
          <Icon name="chevR" size={16} color={colors.chevron} />
        </Row>
        <Divider />
        <Row icon="ruler" label="Units" onPress={() => setSheet("units")}>
          <Text style={styles.value}>{settings.units}</Text>
          <Icon name="chevR" size={16} color={colors.chevron} />
        </Row>
        <Divider />
        <Row icon="bell" label="Notifications">
          <Toggle
            value={settings.notifications}
            onChange={(v) => updateSettings({ notifications: v })}
          />
        </Row>
        <Divider />
        <Row icon="moon" label="Dark Mode">
          <Toggle value={false} onChange={() => comingSoon("Dark mode")} />
        </Row>
      </View>

      <View style={{ height: 14 }} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        onPress={confirmSignOut}
        style={styles.signOut}
      >
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
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 13, paddingVertical: 13 },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.soft,
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
    backgroundColor: colors.dangerBg,
    alignItems: "center",
    justifyContent: "center",
  },
  signOutText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.danger },
});
