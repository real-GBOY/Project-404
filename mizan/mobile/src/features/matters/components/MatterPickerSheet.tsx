import { useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { colors } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { SearchBar } from "@/components/ui/SearchBar";
import { MatterRefBadge } from "@/components/ui/MatterRefBadge";
import { useMatterList } from "../hooks";

export interface PickedMatter {
  id: string;
  reference: string;
  title: string;
}

/** Shared matter selector — used by Quick Capture, Log Time, Expense and the
 *  Files scan flow, all of which file against a matter. */
export function MatterPickerSheet({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (matter: PickedMatter) => void;
}) {
  const { t } = useTranslation("matters");
  const [q, setQ] = useState("");
  const { data } = useMatterList({ q: q || undefined, status: "all" });

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>{t("title")}</Text>
      <View style={{ marginTop: 12 }}>
        <SearchBar placeholder={t("searchPlaceholder")} value={q} onChangeText={setQ} />
      </View>
      <FlatList
        style={{ maxHeight: 360, marginTop: 12 }}
        data={data?.items ?? []}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => {
              onPick({ id: item.id, reference: item.reference, title: item.title });
              onClose();
            }}
          >
            <MatterRefBadge reference={item.reference} small />
            <Text style={styles.rowTitle} numberOfLines={1}>
              {item.title}
            </Text>
          </Pressable>
        )}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fontFamily.extrabold, fontSize: fontSize.display, color: colors.textPrimary, letterSpacing: -0.2 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderHairline },
  rowTitle: { flex: 1, fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.textPrimary },
});
