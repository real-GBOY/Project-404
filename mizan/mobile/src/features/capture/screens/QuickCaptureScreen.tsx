import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { colors, radii } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Icon, type IconName } from "@/components/ui/Icon";
import { PrimaryButton } from "@/components/ui/Button";
import { MatterPickerSheet, type PickedMatter } from "@/features/matters/components/MatterPickerSheet";
import { useMatterMutations } from "@/features/matters/hooks";
import { useDocumentMutations } from "@/features/documents/hooks";
import { capturePhoto, documentFormData } from "@/features/documents/upload";
import { formatDate } from "@/lib/format";
import { useLastUsedMatter, useSetLastUsedMatter } from "../lastUsed";

type Action = "scan" | "note" | null;

export default function QuickCaptureScreen() {
  const { t } = useTranslation("billing");
  const lastUsed = useLastUsedMatter();
  const setLastUsed = useSetLastUsedMatter();

  const [action, setAction] = useState<Action>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [noteMatter, setNoteMatter] = useState<PickedMatter | null>(null);
  const [noteText, setNoteText] = useState("");
  const [pendingImage, setPendingImage] = useState<Awaited<ReturnType<typeof capturePhoto>>>(null);

  const noteMutations = useMatterMutations(noteMatter?.id);
  const { upload } = useDocumentMutations();

  const close = () => router.back();

  const onScan = async () => {
    const img = await capturePhoto();
    if (!img) return;
    setPendingImage(img);
    setAction("scan");
    setPickerOpen(true);
  };

  const onNote = () => {
    setAction("note");
    setPickerOpen(true);
  };

  const onPickMatter = (matter: PickedMatter) => {
    void setLastUsed(matter);
    if (action === "scan" && pendingImage) {
      const form = documentFormData(pendingImage, {
        name: `Scan ${formatDate(new Date())}`,
        matterId: matter.id,
        category: "Evidence",
      });
      upload.mutate(form, {
        onSuccess: close,
        onError: () => Alert.alert(t("common:state.error", { ns: "common" })),
      });
      setPendingImage(null);
    } else if (action === "note") {
      setNoteMatter(matter);
    }
  };

  const saveNote = () => {
    if (noteText.trim() && noteMatter) {
      noteMutations.addNote.mutate({ body: noteText.trim() }, { onSuccess: close });
    }
  };

  const OPTIONS: { icon: IconName; bg: string; fg: string; title: string; subtitle: string; onPress: () => void }[] = [
    {
      icon: "timer",
      bg: colors.brandDark,
      fg: colors.textOnDark,
      title: t("logTime"),
      subtitle: t("logTimeSubtitle"),
      onPress: () => router.replace("/capture/log-time"),
    },
    {
      icon: "receipt_long",
      bg: colors.brandBronze,
      fg: colors.brandBronzeText,
      title: t("captureExpense"),
      subtitle: t("captureExpenseSubtitle"),
      onPress: () => router.replace("/capture/expense"),
    },
    {
      icon: "document_scanner",
      bg: colors.chipInactiveBg,
      fg: colors.brandDeep,
      title: t("scanDocument"),
      subtitle: t("scanDocumentSubtitle"),
      onPress: onScan,
    },
    {
      icon: "note_add",
      bg: colors.chipInactiveBg,
      fg: colors.brandDeep,
      title: t("addNote"),
      subtitle: t("addNoteSubtitle"),
      onPress: onNote,
    },
  ];

  return (
    <>
      <BottomSheet visible={!noteMatter} onClose={close}>
        <Text style={styles.title}>{t("quickCapture")}</Text>
        <Text style={styles.subtitle}>{t("quickCaptureSubtitle")}</Text>
        <View style={{ gap: 10, marginTop: 16 }}>
          {OPTIONS.map((o) => (
            <Pressable key={o.title} style={styles.option} onPress={o.onPress}>
              <View style={[styles.optionIcon, { backgroundColor: o.bg }]}>
                <Icon name={o.icon} size={22} color={o.fg} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>{o.title}</Text>
                <Text style={styles.optionSub}>{o.subtitle}</Text>
              </View>
              <Icon name="chevron_right" size={20} color={colors.chevronMuted} />
            </Pressable>
          ))}
        </View>
        {lastUsed.data ? (
          <View style={styles.historyRow}>
            <Icon name="history" size={18} color={colors.brandBronze} />
            <Text style={styles.historyText} numberOfLines={1}>
              {t("lastUsed", { matter: `${lastUsed.data.reference} ${lastUsed.data.title}` })}
            </Text>
          </View>
        ) : null}
      </BottomSheet>

      <MatterPickerSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} onPick={onPickMatter} />

      <BottomSheet visible={!!noteMatter} onClose={close}>
        <Text style={styles.title}>{t("addNote")}</Text>
        <Text style={styles.subtitle}>{noteMatter ? `${noteMatter.reference} · ${noteMatter.title}` : ""}</Text>
        <TextInput
          value={noteText}
          onChangeText={setNoteText}
          multiline
          placeholder={t("narrative")}
          placeholderTextColor={colors.textSecondary}
          style={styles.noteInput}
        />
        <PrimaryButton
          label={t("common:actions.save", { ns: "common" })}
          onPress={saveNote}
          loading={noteMutations.addNote.isPending}
          style={{ marginTop: 12 }}
        />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fontFamily.extrabold, fontSize: fontSize.display, color: colors.textPrimary, letterSpacing: -0.2 },
  subtitle: { fontFamily: fontFamily.medium, fontSize: fontSize.baseMd, color: colors.textSecondary, marginTop: 5 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lgXl,
    padding: 15,
  },
  optionIcon: { width: 42, height: 42, borderRadius: radii.mdLg, alignItems: "center", justifyContent: "center" },
  optionTitle: { fontFamily: fontFamily.extrabold, fontSize: fontSize.lg, color: colors.textPrimary },
  optionSub: { fontFamily: fontFamily.medium, fontSize: fontSize.base, color: colors.textSecondary, marginTop: 2 },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 14 },
  historyText: { flex: 1, fontFamily: fontFamily.bold, fontSize: fontSize.base, color: colors.chipInactiveText },
  noteInput: {
    marginTop: 12,
    minHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lgXl,
    padding: 14,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    textAlignVertical: "top",
  },
});
