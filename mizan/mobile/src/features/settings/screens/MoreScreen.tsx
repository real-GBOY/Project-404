import type { ReactNode } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { StatusBar } from "expo-status-bar";
import { useAuth } from "@/lib/auth/use-auth";
import { setLocale, type Locale } from "@/lib/i18n";
import { useDir } from "@/lib/i18n/use-dir";
import { restartForDirectionChange } from "@/lib/i18n/restart";
import { formatFileSize } from "@/lib/format";
import { colors, radii } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Toggle } from "@/components/ui/Toggle";
import { notAvailableYet } from "@/lib/not-available";
import { useFirmSettings } from "../hooks";
import { useTeamList } from "@/features/team/hooks";
import { useFinanceSummary } from "@/features/billing/hooks";
import { useOfflineStorageUsed } from "@/features/documents/hooks";

const OFFLINE_CAP_BYTES = 500 * 1024 * 1024;

export default function MoreScreen() {
  const { t } = useTranslation("settings");
  const { t: tb } = useTranslation("billing");
  const insets = useSafeAreaInsets();
  const { user, memberships, logout, biometricEnabled, biometricAvailable, setBiometricEnabled } = useAuth();
  const { locale } = useDir();

  const firm = useFirmSettings();
  const team = useTeamList();
  const finance = useFinanceSummary("invoices");
  const storage = useOfflineStorageUsed();

  // The /team row for the signed-in user carries a nicer title + bar
  // admission than the raw membership role ("owner").
  const meMember = team.data?.items.find((m) => m.email === user?.email);
  const subtitle = [meMember?.title ?? memberships[0]?.membershipRole, meMember?.barAdmission]
    .filter(Boolean)
    .join(" · ");
  const overdue = finance.data?.overdue ?? 0;

  const switchLocale = async (next: Locale) => {
    if (next === locale) return;
    const { requiresRestart } = await setLocale(next);
    if (requiresRestart) await restartForDirectionChange();
  };

  const confirmSignOut = () =>
    Alert.alert(t("signOut"), t("signOut"), [
      { text: t("common:actions.cancel", { ns: "common" }), style: "cancel" },
      { text: t("signOut"), style: "destructive", onPress: () => logout() },
    ]);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Avatar name={user?.displayName ?? user?.email ?? "?"} size={52} round dark />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>
            {user?.displayName ?? user?.email}
          </Text>
          {subtitle ? (
            <Text style={styles.role} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <SectionHeader label={t("firm")} />
          <Card radius="lgXl" padded={false}>
            <Row
              icon="badge"
              label={t("team")}
              trailing={<Text style={styles.trailingMuted}>{team.data?.items.length ?? ""}</Text>}
              onPress={() => notAvailableYet(t("team"))}
            />
            <Row
              icon="receipt_long"
              label={t("finance")}
              trailing={overdue > 0 ? <Text style={styles.trailingDanger}>{tb("overdue", { count: overdue })}</Text> : null}
              onPress={() => router.push("/finance")}
              isLast
            />
          </Card>
        </View>

        <View>
          <SectionHeader label={t("thisDevice")} />
          <Card radius="lgXl" padded={false}>
            <Row
              icon="face"
              label={t("faceIdUnlock")}
              subtitle="Required by firm policy"
              trailing={
                <Toggle
                  value={biometricEnabled}
                  onValueChange={(v) => (biometricAvailable ? setBiometricEnabled(v) : notAvailableYet(t("faceIdUnlock")))}
                />
              }
            />
            <Row
              icon="offline_pin"
              label={t("offlineDocuments")}
              subtitle={t("storageUsed", {
                used: formatFileSize(storage.data ?? 0),
                total: formatFileSize(OFFLINE_CAP_BYTES),
              })}
              onPress={() => router.push("/settings/offline-documents")}
              chevron
              isLast
            />
          </Card>
        </View>

        <View>
          <SectionHeader label={t("language")} />
          <Card radius="lgXl" padded={false}>
            <Row
              label="English"
              trailing={locale === "en" ? <Icon name="check" size={21} color={colors.brandBronze} /> : null}
              onPress={() => switchLocale("en")}
            />
            <Row
              label="العربية — Arabic"
              trailing={locale === "ar" ? <Icon name="check" size={21} color={colors.brandBronze} /> : null}
              onPress={() => switchLocale("ar")}
            />
            <Row icon="shield" label={t("auditLog")} chevron onPress={() => router.push("/settings/audit-log")} />
            <Row
              icon="logout"
              iconColor={colors.dangerText}
              label={t("signOut")}
              labelColor={colors.dangerText}
              onPress={confirmSignOut}
              isLast
            />
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

function Row({
  icon,
  iconColor,
  label,
  labelColor,
  subtitle,
  trailing,
  chevron = false,
  onPress,
  isLast = false,
}: {
  icon?: IconName;
  iconColor?: string;
  label: string;
  labelColor?: string;
  subtitle?: string;
  trailing?: ReactNode;
  chevron?: boolean;
  onPress?: () => void;
  isLast?: boolean;
}) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper style={[styles.row, !isLast && styles.rowBorder]} onPress={onPress}>
      {icon ? <Icon name={icon} size={21} color={iconColor ?? colors.brandDeep} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, labelColor ? { color: labelColor } : null]}>{label}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      {trailing}
      {chevron ? <Icon name="chevron_right" size={20} color={colors.chevronMuted} /> : null}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.brandDark,
    paddingHorizontal: 20,
    paddingBottom: 22,
  },
  name: { fontFamily: fontFamily.extrabold, fontSize: fontSize.xxl, color: colors.textOnDark },
  role: { fontFamily: fontFamily.semibold, fontSize: fontSize.base, color: colors.brandTan, marginTop: 3 },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  row: { flexDirection: "row", alignItems: "center", gap: 13, paddingHorizontal: 15, paddingVertical: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderHairline },
  rowLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.mdLg, color: colors.textPrimary },
  rowSub: { fontFamily: fontFamily.medium, fontSize: fontSize.smMd, color: colors.textSecondary, marginTop: 2 },
  trailingMuted: { fontFamily: fontFamily.semibold, fontSize: fontSize.baseMd, color: colors.textSecondary },
  trailingDanger: { fontFamily: fontFamily.bold, fontSize: fontSize.base, color: colors.dangerText },
});
