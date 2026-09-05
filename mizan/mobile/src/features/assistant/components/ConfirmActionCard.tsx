import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { colors, radii } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";
import { Icon, type IconName } from "@/components/ui/Icon";
import { PrimaryButton, SecondaryButton } from "@/components/ui/Button";

export interface ConfirmField {
  label: string;
  value: string;
}

/**
 * The "confirm-before-acting" card from design screen 17 — states every
 * field the action will write before anything is saved. Reusable: the moment
 * a real assistant endpoint exists, its tool-call payloads render through
 * this unchanged.
 */
export function ConfirmActionCard({
  icon,
  title,
  fields,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  icon: IconName;
  title: string;
  fields: ConfirmField[];
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation("assistant");
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Icon name={icon} size={18} color={colors.brandDeep} />
        <Text style={styles.title}>{title}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{t("needsConfirmation")}</Text>
        </View>
      </View>
      <View style={styles.grid}>
        {fields.map((f) => (
          <View key={f.label} style={styles.gridItem}>
            <Text style={styles.fieldLabel}>{f.label}</Text>
            <Text style={styles.fieldValue}>{f.value}</Text>
          </View>
        ))}
      </View>
      <View style={styles.footer}>
        <PrimaryButton label={confirmLabel} icon="check" onPress={onConfirm} style={{ height: 44 }} />
        <SecondaryButton label={t("common:actions.cancel", { ns: "common" })} onPress={onCancel} style={{ height: 44 }} />
        <Text style={styles.notice}>{t("nothingSavedYet")}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.brandCreamBorder, backgroundColor: colors.surfaceMuted, borderRadius: radii.xl, overflow: "hidden", marginTop: 11 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#EEE4D8" },
  title: { flex: 1, fontFamily: fontFamily.extrabold, fontSize: fontSize.baseMd, color: colors.textPrimary },
  badge: { backgroundColor: colors.brandCream, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontFamily: fontFamily.extrabold, fontSize: 10, color: colors.brandDeep },
  grid: { flexDirection: "row", flexWrap: "wrap", padding: 14, gap: 13 },
  gridItem: { width: "45%", flexGrow: 1 },
  fieldLabel: { fontFamily: fontFamily.extrabold, fontSize: 10, letterSpacing: 0.4, color: colors.textSecondary, marginBottom: 3 },
  fieldValue: { fontFamily: fontFamily.bold, fontSize: fontSize.baseMd, color: colors.textPrimary },
  footer: { padding: 14, borderTopWidth: 1, borderTopColor: "#EEE4D8", gap: 9 },
  notice: { fontFamily: fontFamily.medium, fontSize: fontSize.sm, color: colors.textSecondary, textAlign: "center" },
});
