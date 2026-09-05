import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert, Image } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { colors, radii } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";
import { TopBar } from "@/components/ui/TopBar";
import { PrimaryButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Toggle } from "@/components/ui/Toggle";
import { MatterRefBadge } from "@/components/ui/MatterRefBadge";
import { MatterPickerSheet, type PickedMatter } from "@/features/matters/components/MatterPickerSheet";
import { useFirmSettings } from "@/features/settings/hooks";
import { capturePhoto, documentFormData } from "@/features/documents/upload";
import { useDocumentMutations } from "@/features/documents/hooks";
import { useExpenseMutations } from "../hooks";
import { formatDate } from "@/lib/format";
import { useSetLastUsedMatter } from "@/features/capture/lastUsed";

export default function ExpenseScreen() {
  const { t } = useTranslation("billing");
  const { data: settings } = useFirmSettings();
  const currency = settings?.defaultCurrency ?? "EGP";
  const { record } = useExpenseMutations();
  const { upload } = useDocumentMutations();
  const setLastUsed = useSetLastUsedMatter();

  const [image, setImage] = useState<Awaited<ReturnType<typeof capturePhoto>>>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [matter, setMatter] = useState<PickedMatter | null>(null);
  const [matterPicker, setMatterPicker] = useState(false);
  const [recharge, setRecharge] = useState(true);

  const takePhoto = async () => {
    const img = await capturePhoto();
    if (img) setImage(img);
  };

  const submit = async () => {
    const value = Number(amount.replace(/[^\d.]/g, ""));
    if (!value || !description.trim() || !matter) {
      Alert.alert(t("newExpense"), t("amount"));
      return;
    }
    void setLastUsed(matter);

    // Receipt photo → a real document tagged to the matter (there's no
    // expense↔document linkage field on the backend, so these are two
    // independent real records).
    if (image) {
      const form = documentFormData(image, {
        name: `Receipt ${formatDate(new Date())}`,
        matterId: matter.id,
        category: "Receipt",
      });
      upload.mutate(form);
    }

    record.mutate(
      {
        description: description.trim(),
        // The design's "recharge to client" toggle maps to the disbursement /
        // overhead distinction (disbursements are client-rechargeable).
        category: recharge ? "Disbursement" : "Overhead",
        amount: value,
        currency,
        matterId: matter.id,
      },
      {
        onSuccess: () => router.back(),
        onError: () => Alert.alert(t("common:state.error", { ns: "common" })),
      },
    );
  };

  return (
    <View style={styles.screen}>
      <TopBar title={t("newExpense")} onClose={() => router.back()} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.photoCard}>
          {image ? (
            <Image source={{ uri: image.uri }} style={styles.photo} resizeMode="cover" />
          ) : (
            <Pressable style={styles.photoPlaceholder} onPress={takePhoto}>
              <Icon name="receipt_long" size={34} color={colors.iconMuted} />
              <Text style={styles.photoHint}>{t("captureExpenseSubtitle")}</Text>
            </Pressable>
          )}
          <View style={styles.photoActions}>
            <Pressable style={styles.photoAction} onPress={takePhoto}>
              <Icon name="photo_camera" size={19} color={colors.brandBronze} />
              <Text style={styles.photoActionText}>{t("retake")}</Text>
            </Pressable>
            <Pressable onPress={takePhoto}>
              <Text style={[styles.photoActionText, { color: colors.brandBronzeLabel }]}>{t("addPage")}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.fieldCard}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t("amount")}</Text>
            <View style={styles.amountRow}>
              <Text style={styles.currencyPrefix}>{currency}</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                style={styles.amountInput}
              />
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t("description")}</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={t("description")}
              placeholderTextColor={colors.textSecondary}
              style={styles.textInput}
            />
          </View>
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
          <View style={[styles.field, styles.fieldLast, styles.rechargeRow]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rechargeTitle}>{t("rechargeToClient")}</Text>
              <Text style={styles.rechargeSub}>{t("rechargeSubtitle")}</Text>
            </View>
            <Toggle value={recharge} onValueChange={setRecharge} />
          </View>
        </View>

        <PrimaryButton label={t("confirmSubmit")} icon="check" onPress={submit} loading={record.isPending} />
      </ScrollView>

      <MatterPickerSheet visible={matterPicker} onClose={() => setMatterPicker(false)} onPick={setMatter} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  photoCard: { borderRadius: radii.xxl, overflow: "hidden", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  photo: { height: 186, width: "100%" },
  photoPlaceholder: { height: 186, backgroundColor: colors.bgSunk, alignItems: "center", justifyContent: "center", gap: 9 },
  photoHint: { fontFamily: fontFamily.mono, fontSize: fontSize.xs, color: colors.textSecondary },
  photoActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, paddingHorizontal: 15 },
  photoAction: { flexDirection: "row", alignItems: "center", gap: 10 },
  photoActionText: { fontFamily: fontFamily.bold, fontSize: fontSize.baseMd, color: colors.textPrimary },
  fieldCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lgXl, overflow: "hidden" },
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
  amountRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  currencyPrefix: { fontFamily: fontFamily.bold, fontSize: fontSize.displayMd, color: colors.textSecondary },
  amountInput: { flex: 1, fontFamily: fontFamily.extrabold, fontSize: fontSize.displayLg, color: colors.textPrimary, padding: 0 },
  textInput: { fontFamily: fontFamily.bold, fontSize: fontSize.mdLg, color: colors.textPrimary, padding: 0 },
  fieldValueRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  fieldValue: { flex: 1, fontFamily: fontFamily.semibold, fontSize: fontSize.md, color: colors.textPrimary },
  rechargeRow: { flexDirection: "row", alignItems: "center" },
  rechargeTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.mdLg, color: colors.textPrimary },
  rechargeSub: { fontFamily: fontFamily.medium, fontSize: fontSize.smMd, color: colors.textSecondary, marginTop: 2 },
});
