import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet, Linking } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { formatDate, formatMoneyList } from "@/lib/format";
import { colors, radii } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";
import { TopBar } from "@/components/ui/TopBar";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { PrimaryButton, SecondaryButton, IconButton } from "@/components/ui/Button";
import { MatterRefBadge } from "@/components/ui/MatterRefBadge";
import { notAvailableYet } from "@/lib/not-available";
import { useClient, useClientMatters, useClientActivity } from "../hooks";

export default function ClientProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const clientId = String(id);
  const { t } = useTranslation("clients");
  const { data: client, isLoading } = useClient(clientId);
  const matters = useClientMatters(clientId);
  const activity = useClientActivity(clientId);

  if (isLoading || !client) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brandDark} />
      </View>
    );
  }

  const money = (m: { currency: string; amount: string }[]) => (m.length ? formatMoneyList(m).join(" · ") : "—");

  return (
    <View style={styles.screen}>
      <TopBar
        onBack={() => router.back()}
        actions={[{ icon: "more_vert", onPress: () => {} }]}
      >
        <View style={styles.identity}>
          <Avatar name={client.name} size={54} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.name} numberOfLines={2}>
              {client.name}
            </Text>
            <Text style={styles.meta}>
              {client.type === "company" ? "Corporate" : "Individual"} ·{" "}
              {t("clientSince", { date: formatDate(client.createdAt, { month: "long", year: "numeric" }) })}
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <PrimaryButton
            label={t("call")}
            icon="call"
            onPress={() => client.phone && Linking.openURL(`tel:${client.phone}`)}
            disabled={!client.phone}
            style={{ flex: 1, height: 44 }}
          />
          <SecondaryButton
            label={t("email")}
            icon="mail"
            onPress={() => client.email && Linking.openURL(`mailto:${client.email}`)}
            disabled={!client.email}
            style={{ flex: 1, height: 44 }}
          />
          <IconButton icon="note_add" variant="outline" size={44} onPress={() => notAvailableYet(client.name)} />
        </View>
      </TopBar>

      <ScrollView contentContainerStyle={styles.content}>
        {client.primaryContact ? (
          <Card radius="lgXl">
            <SectionHeader label={t("primaryContact")} />
            <Text style={styles.contactName}>{client.primaryContact.name}</Text>
            {client.primaryContact.role ? <Text style={styles.contactRole}>{client.primaryContact.role}</Text> : null}
            {client.primaryContact.phone ? <Text style={styles.contactLine}>{client.primaryContact.phone}</Text> : null}
            {client.primaryContact.email ? <Text style={styles.contactLine}>{client.primaryContact.email}</Text> : null}
          </Card>
        ) : null}

        <View style={styles.statRow}>
          <Card radius="lgXl" style={{ flex: 1 }}>
            <Text style={styles.statLabel}>{t("billedToDate")}</Text>
            <Text style={styles.statValue}>{money(client.stats.billedToDate)}</Text>
          </Card>
          <Card radius="lgXl" style={{ flex: 1 }}>
            <Text style={styles.statLabel}>{t("outstanding")}</Text>
            <Text style={[styles.statValue, { color: colors.dangerText }]}>{money(client.stats.outstanding)}</Text>
          </Card>
        </View>

        <View>
          <SectionHeader label={t("openMatters", { count: client.stats.openMatters })} />
          <Card radius="lgXl" padded={false}>
            {(matters.data ?? []).filter((m) => m.status !== "closed").map((m, i, arr) => (
              <Pressable
                key={m.id}
                style={[styles.matterRow, i < arr.length - 1 && styles.rowBorder]}
                onPress={() => router.push(`/case/${m.id}`)}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.matterTitle} numberOfLines={1}>
                    {m.title}
                  </Text>
                  <View style={styles.matterMeta}>
                    <MatterRefBadge reference={m.reference} small />
                    <Text style={styles.matterMetaText}>
                      {m.nextHearing ? formatDate(m.nextHearing, { day: "numeric", month: "short" }) : m.practiceArea}
                    </Text>
                  </View>
                </View>
                <Icon name="chevron_right" size={20} color={colors.chevronMuted} />
              </Pressable>
            ))}
          </Card>
        </View>

        <View>
          <SectionHeader label={t("recentContact")} />
          <Card radius="lgXl" style={{ gap: 14 }}>
            {(activity.data ?? []).slice(0, 6).map((a) => (
              <View key={a.id} style={styles.activityRow}>
                <View style={styles.activityIcon}>
                  <Icon name="history" size={16} color={colors.brandDeep} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityTitle}>
                    {a.action} {a.target}
                  </Text>
                  <Text style={styles.activityMeta}>
                    {formatDate(a.at, { day: "numeric", month: "short" })} · {a.actor}
                  </Text>
                </View>
              </View>
            ))}
            {(activity.data ?? []).length === 0 ? (
              <Text style={styles.activityMeta}>{t("common:state.empty", { ns: "common" })}</Text>
            ) : null}
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  identity: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 14 },
  name: { fontFamily: fontFamily.extrabold, fontSize: fontSize.xxl, lineHeight: 21, color: colors.textPrimary },
  meta: { fontFamily: fontFamily.semibold, fontSize: fontSize.base, color: colors.textSecondary, marginTop: 4 },
  actions: { flexDirection: "row", gap: 9, marginTop: 16 },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  contactName: { fontFamily: fontFamily.bold, fontSize: fontSize.mdLg, color: colors.textPrimary },
  contactRole: { fontFamily: fontFamily.medium, fontSize: fontSize.base, color: colors.textSecondary, marginTop: 3 },
  contactLine: { fontFamily: fontFamily.semibold, fontSize: fontSize.baseMd, color: colors.brandDeep, marginTop: 6 },
  statRow: { flexDirection: "row", gap: 11 },
  statLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.sm, color: colors.textSecondary },
  statValue: { fontFamily: fontFamily.extrabold, fontSize: fontSize.xl, color: colors.textPrimary, marginTop: 6 },
  matterRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 15, paddingVertical: 13 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderHairline },
  matterTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.textPrimary },
  matterMeta: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 6 },
  matterMetaText: { fontFamily: fontFamily.semibold, fontSize: fontSize.sm, color: colors.textSecondary },
  activityRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  activityIcon: { width: 30, height: 30, borderRadius: radii.pill, backgroundColor: colors.brandCream, alignItems: "center", justifyContent: "center" },
  activityTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.baseMd, color: colors.textPrimary },
  activityMeta: { fontFamily: fontFamily.medium, fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
});
