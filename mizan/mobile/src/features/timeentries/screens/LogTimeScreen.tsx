import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { colors, radii } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";
import { TopBar } from "@/components/ui/TopBar";
import { PrimaryButton, BronzeButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Toggle } from "@/components/ui/Toggle";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { MatterRefBadge } from "@/components/ui/MatterRefBadge";
import { MatterPickerSheet, type PickedMatter } from "@/features/matters/components/MatterPickerSheet";
import { useMatter } from "@/features/matters/hooks";
import { useFirmSettings } from "@/features/settings/hooks";
import { formatMoney } from "@/lib/format";
import { useSaveTimeEntry } from "../local";
import { useSetLastUsedMatter } from "@/features/capture/lastUsed";

const PRESETS = [0.5, 1, 1.5, 3];
const ACTIVITIES = [
  "Hearing attendance",
  "Drafting",
  "Legal research",
  "Client meeting",
  "Document review",
  "Correspondence",
];

function hms(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export default function LogTimeScreen() {
  const { t } = useTranslation("billing");
  const params = useLocalSearchParams<{ matterId?: string }>();
  const { data: presetMatter } = useMatter(params.matterId ? String(params.matterId) : "");
  const { data: settings } = useFirmSettings();
  const save = useSaveTimeEntry();
  const setLastUsed = useSetLastUsedMatter();

  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  const [matter, setMatter] = useState<PickedMatter | null>(null);
  const [matterPicker, setMatterPicker] = useState(false);
  const [activity, setActivity] = useState(ACTIVITIES[0]);
  const [activityPicker, setActivityPicker] = useState(false);
  const [narrative, setNarrative] = useState("");
  const [billable, setBillable] = useState(true);

  useEffect(() => {
    if (presetMatter && !matter) {
      setMatter({ id: presetMatter.id, reference: presetMatter.reference, title: presetMatter.title });
    }
  }, [presetMatter, matter]);

  useEffect(() => {
    if (running) {
      tick.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else if (tick.current) {
      clearInterval(tick.current);
    }
    return () => {
      if (tick.current) clearInterval(tick.current);
    };
  }, [running]);

  const rate = settings?.standardRates?.[0]?.hourlyRate ?? null;
  const currency = settings?.defaultCurrency ?? "EGP";
  const hours = seconds / 3600;
  const value = rate ? hours * rate : null;

  const toggleRun = () => {
    if (!running && !startedAt) setStartedAt(new Date());
    setRunning((r) => !r);
  };
  const stop = () => {
    setRunning(false);
  };
  const applyPreset = (h: number) => {
    setRunning(false);
    setSeconds(h * 3600);
  };

  const onSave = () => {
    if (!matter || seconds <= 0) {
      Alert.alert(t("saveEntry"), t("matter"));
      return;
    }
    void setLastUsed(matter);
    save.mutate(
      {
        matterId: matter.id,
        matterReference: matter.reference,
        matterTitle: matter.title,
        activity,
        narrative: narrative.trim(),
        seconds,
        billable,
        hourlyRate: rate,
        currency,
      },
      {
        onSuccess: () => {
          Alert.alert(t("saveEntry"), t("common:state.savedLocally", { ns: "common" }), [
            { text: "OK", onPress: () => router.back() },
          ]);
        },
      },
    );
  };

  return (
    <View style={styles.screen}>
      <TopBar
        title={t("logTime")}
        onClose={() => router.back()}
        trailing={
          <Pressable onPress={onSave} hitSlop={8}>
            <Text style={styles.saveLink}>{t("common:actions.save", { ns: "common" })}</Text>
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.timerCard}>
          <Text style={styles.timer}>{hms(seconds)}</Text>
          <Text style={styles.timerSub}>
            {startedAt
              ? `${t("logTimeSubtitle")}`
              : t("logTimeSubtitle")}
          </Text>
          <View style={styles.timerButtons}>
            <BronzeButton
              label={running ? "Pause" : "Start"}
              icon={running ? "pause" : "timer"}
              onPress={toggleRun}
              style={{ flex: 1, height: 46 }}
            />
            <Pressable style={styles.stopBtn} onPress={stop}>
              <Icon name="stop" size={20} color={colors.brandCream} />
              <Text style={styles.stopText}>Stop</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.presets}>
          {PRESETS.map((h) => {
            const active = Math.abs(seconds - h * 3600) < 1;
            return (
              <Pressable key={h} style={[styles.preset, active && styles.presetActive]} onPress={() => applyPreset(h)}>
                <Text style={[styles.presetText, active && styles.presetTextActive]}>{h} h</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.fieldCard}>
          <Pressable style={styles.field} onPress={() => setMatterPicker(true)}>
            <Text style={styles.fieldLabel}>{t("matter")}</Text>
            <View style={styles.fieldValueRow}>
              {matter ? <MatterRefBadge reference={matter.reference} /> : null}
              <Text style={styles.fieldValue} numberOfLines={1}>
                {matter?.title ?? "—"}
              </Text>
              <Icon name="expand_more" size={20} color={colors.chevronMuted} />
            </View>
          </Pressable>
          <Pressable style={styles.field} onPress={() => setActivityPicker(true)}>
            <Text style={styles.fieldLabel}>{t("activity")}</Text>
            <View style={styles.fieldValueRow}>
              <Text style={[styles.fieldValue, { fontFamily: fontFamily.bold }]}>{activity}</Text>
              <Icon name="expand_more" size={20} color={colors.chevronMuted} />
            </View>
          </Pressable>
          <View style={[styles.field, styles.fieldLast]}>
            <Text style={styles.fieldLabel}>{t("narrative")}</Text>
            <TextInput
              value={narrative}
              onChangeText={setNarrative}
              multiline
              placeholder={t("narrative")}
              placeholderTextColor={colors.textSecondary}
              style={styles.narrativeInput}
            />
            <View style={styles.dictateRow}>
              <Icon name="mic" size={19} color={colors.brandBronze} />
              <Text style={styles.dictateText}>{t("dictateInstead")}</Text>
            </View>
          </View>
        </View>

        <View style={styles.billableCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.billableTitle}>{t("billable")}</Text>
            {rate ? (
              <Text style={styles.billableSub}>
                {formatMoney({ currency, amount: String(rate) })} / h
                {value ? ` · ${formatMoney({ currency, amount: value.toFixed(0) })}` : ""}
              </Text>
            ) : null}
          </View>
          <Toggle value={billable} onValueChange={setBillable} />
        </View>

        <PrimaryButton label={t("saveEntry")} onPress={onSave} loading={save.isPending} />
        <Text style={styles.localNote}>{t("common:state.savedLocally", { ns: "common" })}</Text>
      </ScrollView>

      <MatterPickerSheet
        visible={matterPicker}
        onClose={() => setMatterPicker(false)}
        onPick={(m) => setMatter(m)}
      />

      <BottomSheet visible={activityPicker} onClose={() => setActivityPicker(false)}>
        <Text style={styles.sheetTitle}>{t("activity")}</Text>
        <View style={{ marginTop: 12 }}>
          {ACTIVITIES.map((a) => (
            <Pressable
              key={a}
              style={styles.activityRow}
              onPress={() => {
                setActivity(a);
                setActivityPicker(false);
              }}
            >
              <Text style={styles.activityLabel}>{a}</Text>
              {a === activity ? <Icon name="check" size={20} color={colors.brandBronze} /> : null}
            </Pressable>
          ))}
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  saveLink: { fontFamily: fontFamily.extrabold, fontSize: fontSize.md, color: colors.textSecondary },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  timerCard: { backgroundColor: colors.brandDark, borderRadius: radii.xxl, padding: 22, alignItems: "center" },
  timer: { fontFamily: fontFamily.mono, fontWeight: "700", fontSize: fontSize.timer, color: colors.textOnDark, letterSpacing: -0.5 },
  timerSub: { fontFamily: fontFamily.semibold, fontSize: fontSize.base, color: colors.brandTan, marginTop: 6 },
  timerButtons: { flexDirection: "row", gap: 10, marginTop: 18, alignSelf: "stretch" },
  stopBtn: {
    flex: 1,
    height: 46,
    borderRadius: radii.mdLg,
    backgroundColor: colors.brandDeep,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  stopText: { fontFamily: fontFamily.extrabold, fontSize: fontSize.lg, color: colors.brandCream },
  presets: { flexDirection: "row", gap: 9 },
  preset: {
    flex: 1,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  presetActive: { backgroundColor: colors.brandCream, borderColor: colors.brandCreamBorder },
  presetText: { fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.textPrimary },
  presetTextActive: { fontFamily: fontFamily.extrabold, color: colors.brandAmberBannerText },
  fieldCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lgXl,
    overflow: "hidden",
  },
  field: { paddingHorizontal: 15, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderHairline },
  fieldLast: { borderBottomWidth: 0 },
  fieldLabel: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.sm,
    letterSpacing: 0.5,
    color: colors.textSecondary,
    textTransform: "uppercase",
    marginBottom: 7,
  },
  fieldValueRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  fieldValue: { flex: 1, fontFamily: fontFamily.semibold, fontSize: fontSize.md, color: colors.textPrimary },
  narrativeInput: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.chatTextAlt,
    lineHeight: 21,
    minHeight: 60,
    textAlignVertical: "top",
    padding: 0,
  },
  dictateRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  dictateText: { fontFamily: fontFamily.bold, fontSize: fontSize.baseMd, color: colors.brandDeep },
  billableCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lgXl,
    padding: 15,
  },
  billableTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.mdLg, color: colors.textPrimary },
  billableSub: { fontFamily: fontFamily.medium, fontSize: fontSize.smMd, color: colors.textSecondary, marginTop: 2 },
  localNote: { fontFamily: fontFamily.medium, fontSize: fontSize.base, color: colors.textSecondary, textAlign: "center" },
  sheetTitle: { fontFamily: fontFamily.extrabold, fontSize: fontSize.display, color: colors.textPrimary },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderHairline,
  },
  activityLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.mdLg, color: colors.textPrimary },
});
