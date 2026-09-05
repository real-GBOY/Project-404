import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Share,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { formatDate, formatTime } from "@/lib/format";
import { colors, radii } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";
import { TopBar } from "@/components/ui/TopBar";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Icon } from "@/components/ui/Icon";
import { BronzeButton, PrimaryButton } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { DateTimeField } from "@/components/ui/DateTimeField";
import { useHearing, useHearingMutations } from "../hooks";
import { useCheckIn } from "../checkin";
import { useMatterParticipants, useMatterMutations } from "@/features/matters/hooks";
import { useDocumentList } from "@/features/documents/hooks";

export default function HearingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const hearingId = String(id);
  const { t } = useTranslation("hearings");
  const { data: hearing, isLoading } = useHearing(hearingId);
  const matterId = hearing?.matterId;

  const participants = useMatterParticipants(matterId ?? "");
  const docs = useDocumentList({ matterId: matterId ?? undefined });
  const { checkedInAt, checkIn } = useCheckIn(hearingId);
  const { adjourn, outcome } = useHearingMutations(matterId);
  const { addUpdate } = useMatterMutations(matterId);

  const [adjournSheet, setAdjournSheet] = useState(false);
  const [newDate, setNewDate] = useState<Date | null>(null);
  const [reason, setReason] = useState("");
  const [noteSheet, setNoteSheet] = useState(false);
  const [note, setNote] = useState("");

  if (isLoading || !hearing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brandDark} />
      </View>
    );
  }

  const d = new Date(hearing.scheduledAt);

  const confirmOutcome = (label: string) =>
    Alert.alert(t("recordOutcome"), label, [
      { text: t("common:actions.cancel", { ns: "common" }), style: "cancel" },
      {
        text: t("common:actions.confirm", { ns: "common" }),
        onPress: () => outcome.mutate({ id: hearingId, outcome: label }, { onSuccess: () => router.back() }),
      },
    ]);

  const submitAdjourn = () => {
    if (!newDate) return;
    adjourn.mutate(
      { id: hearingId, newDate: newDate.toISOString(), reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          setAdjournSheet(false);
          router.back();
        },
        onError: () => Alert.alert(t("common:state.error", { ns: "common" })),
      },
    );
  };

  const saveNote = () => {
    if (note.trim() && matterId) addUpdate.mutate({ body: note.trim() });
    setNote("");
    setNoteSheet(false);
  };

  return (
    <View style={styles.screen}>
      <TopBar
        title={t("title")}
        onBack={() => router.back()}
        actions={[
          {
            icon: "share",
            onPress: () =>
              Share.share({
                message: `${hearing.matterTitle} — ${formatDate(hearing.scheduledAt)} ${formatTime(hearing.scheduledAt)} · ${hearing.court}`,
              }),
          },
        ]}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <Text style={styles.heroDate}>
            {formatDate(hearing.scheduledAt, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase()}
          </Text>
          <Text style={styles.heroTime}>{formatTime(hearing.scheduledAt)}</Text>
          <Text style={styles.heroMatter}>{hearing.matterTitle}</Text>
          <View style={styles.heroDivider}>
            <View style={styles.heroRefBadge}>
              <Text style={styles.heroRefText}>{hearing.matterReference}</Text>
            </View>
            {hearing.purpose ? (
              <View style={styles.purposePill}>
                <Text style={styles.purposePillText}>{hearing.purpose}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <Card radius="lgXl" style={{ gap: 13 }}>
          <InfoRow icon="location_on" title={hearing.court} subtitle={hearing.clientName} />
          <InfoRow
            icon="groups"
            title={(participants.data ?? []).map((p) => p.name).join(" · ") || hearing.leadLawyer}
            subtitle={t("attendees")}
          />
          <InfoRow
            icon="folder_open"
            title={t("bundle", { count: docs.data?.items.length ?? 0 })}
            subtitle={t("bundleOffline")}
          />
        </Card>

        {checkedInAt ? (
          <View style={styles.checkedIn}>
            <Icon name="check_circle" size={20} color={colors.successText} />
            <View style={{ flex: 1 }}>
              <Text style={styles.checkedInText}>{t("checkedIn", { time: formatTime(checkedInAt) })}</Text>
              <Text style={styles.checkedInNotice}>{t("checkInLocalNotice")}</Text>
            </View>
          </View>
        ) : (
          <BronzeButton label={t("checkIn")} icon="how_to_reg" onPress={() => checkIn.mutate()} />
        )}

        <View>
          <SectionHeader label={t("recordOutcome")} />
          <Card radius="lgXl" padded={false}>
            <OutcomeRow icon="event_repeat" label={t("adjourn")} onPress={() => setAdjournSheet(true)} />
            <OutcomeRow icon="record_voice_over" label={t("pleadingsHeard")} onPress={() => confirmOutcome(t("pleadingsHeard"))} />
            <OutcomeRow icon="balance" label={t("judgmentIssued")} onPress={() => confirmOutcome(t("judgmentIssued"))} isLast />
          </Card>
        </View>

        <Pressable style={styles.dictateBanner} onPress={() => setNoteSheet(true)}>
          <Icon name="mic" size={20} color={colors.brandDeep} />
          <View style={{ flex: 1 }}>
            <Text style={styles.dictateTitle}>{t("dictateNote")}</Text>
            <Text style={styles.dictateBody}>{t("dictateNoteBody")}</Text>
          </View>
        </Pressable>
      </ScrollView>

      <BottomSheet visible={adjournSheet} onClose={() => setAdjournSheet(false)}>
        <Text style={styles.sheetTitle}>{t("adjourn")}</Text>
        <View style={{ gap: 14, marginTop: 14 }}>
          <DateTimeField label={t("newDateLabel")} value={newDate} onChange={setNewDate} />
          <View>
            <Text style={styles.fieldLabel}>{t("reasonLabel")}</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder={t("reasonLabel")}
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
            />
          </View>
          <PrimaryButton
            label={t("common:actions.confirm", { ns: "common" })}
            onPress={submitAdjourn}
            disabled={!newDate}
            loading={adjourn.isPending}
          />
        </View>
      </BottomSheet>

      <BottomSheet visible={noteSheet} onClose={() => setNoteSheet(false)}>
        <Text style={styles.sheetTitle}>{t("dictateNote")}</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          multiline
          placeholder={t("dictateNote")}
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, { minHeight: 100, textAlignVertical: "top", marginTop: 12 }]}
        />
        <PrimaryButton label={t("common:actions.save", { ns: "common" })} onPress={saveNote} style={{ marginTop: 12 }} />
      </BottomSheet>
    </View>
  );
}

function InfoRow({ icon, title, subtitle }: { icon: Parameters<typeof Icon>[0]["name"]; title: string; subtitle: string }) {
  return (
    <View style={styles.infoRow}>
      <Icon name={icon} size={20} color={colors.brandBronze} />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text style={styles.infoSub}>{subtitle}</Text>
      </View>
    </View>
  );
}

function OutcomeRow({
  icon,
  label,
  onPress,
  isLast = false,
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  label: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable style={[styles.outcomeRow, !isLast && styles.rowBorder]} onPress={onPress}>
      <Icon name={icon} size={20} color={colors.brandDeep} />
      <Text style={styles.outcomeLabel}>{label}</Text>
      <Icon name="chevron_right" size={20} color={colors.chevronMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  heroCard: { backgroundColor: colors.brandDark, borderRadius: radii.xxl, padding: 18 },
  heroDate: { fontFamily: fontFamily.bold, fontSize: fontSize.base, color: colors.brandTan, letterSpacing: 0.5 },
  heroTime: { fontFamily: fontFamily.extrabold, fontSize: fontSize.heroLg, color: colors.textOnDark, letterSpacing: -0.5, marginTop: 6 },
  heroMatter: { fontFamily: fontFamily.bold, fontSize: fontSize.lgMd, color: colors.brandCream, marginTop: 12, lineHeight: 20 },
  heroDivider: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.brandDeep },
  heroRefBadge: { backgroundColor: colors.brandDeep, borderRadius: radii.sm, paddingHorizontal: 9, paddingVertical: 4 },
  heroRefText: { fontFamily: fontFamily.mono, fontWeight: "700", fontSize: fontSize.sm, color: colors.brandCream },
  purposePill: { backgroundColor: colors.brandBronze, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 4 },
  purposePillText: { fontFamily: fontFamily.extrabold, fontSize: fontSize.sm, color: colors.brandBronzeText },
  infoRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  infoTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.textPrimary },
  infoSub: { fontFamily: fontFamily.medium, fontSize: fontSize.base, color: colors.textSecondary, marginTop: 3 },
  checkedIn: {
    flexDirection: "row",
    gap: 11,
    alignItems: "center",
    backgroundColor: colors.successBg,
    borderRadius: radii.lgXl,
    padding: 14,
  },
  checkedInText: { fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.successText },
  checkedInNotice: { fontFamily: fontFamily.medium, fontSize: fontSize.base, color: colors.textSecondary, marginTop: 2 },
  outcomeRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 15, paddingVertical: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderHairline },
  outcomeLabel: { flex: 1, fontFamily: fontFamily.bold, fontSize: fontSize.mdLg, color: colors.textPrimary },
  dictateBanner: {
    flexDirection: "row",
    gap: 11,
    backgroundColor: colors.brandAmberBannerBg,
    borderWidth: 1,
    borderColor: colors.brandCreamBorder,
    borderRadius: radii.lgXl,
    padding: 14,
  },
  dictateTitle: { fontFamily: fontFamily.extrabold, fontSize: fontSize.md, color: colors.brandAmberBannerText },
  dictateBody: { fontFamily: fontFamily.medium, fontSize: fontSize.base, color: colors.brandAmberBannerSubtext, marginTop: 3, lineHeight: 18 },
  sheetTitle: { fontFamily: fontFamily.extrabold, fontSize: fontSize.display, color: colors.textPrimary, letterSpacing: -0.2 },
  fieldLabel: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.sm,
    letterSpacing: 0.6,
    color: colors.textSecondary,
    textTransform: "uppercase",
    marginBottom: 7,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
});
