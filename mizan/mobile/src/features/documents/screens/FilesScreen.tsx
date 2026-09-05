import { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet, Alert, RefreshControl } from "react-native";
import { useRefresh } from "@/lib/use-refresh";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatDate, formatFileSize } from "@/lib/format";
import { colors, radii } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";
import { SearchBar } from "@/components/ui/SearchBar";
import { Chip } from "@/components/ui/Chip";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MatterRefBadge } from "@/components/ui/MatterRefBadge";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { FAB } from "@/components/ui/FAB";
import { MatterPickerSheet } from "@/features/matters/components/MatterPickerSheet";
import { useDocumentList, useOfflineDocuments, useOfflineStorageUsed, useOfflinePinning, useDocumentMutations } from "../hooks";
import { capturePhoto, documentFormData } from "../upload";
import type { DocRow } from "../types";

type Filter = "recent" | "offline" | "review";

export default function FilesScreen() {
  const { t } = useTranslation("documents");
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("recent");
  const [scanSheet, setScanSheet] = useState(false);
  const [pendingImage, setPendingImage] = useState<Awaited<ReturnType<typeof capturePhoto>>>(null);

  const { data, isLoading, refetch } = useDocumentList({ q: query || undefined });
  const offline = useOfflineDocuments();
  const { refreshing, onRefresh } = useRefresh(refetch, offline.refetch);
  const storageUsed = useOfflineStorageUsed();
  const { pin, unpin } = useOfflinePinning();
  const { upload } = useDocumentMutations();

  const offlineIds = useMemo(() => new Set((offline.data ?? []).map((e) => e.id)), [offline.data]);

  const all = data?.items ?? [];
  const review = all.filter((d) => d.status === "draft");
  const list = useMemo(() => {
    if (filter === "offline") return all.filter((d) => offlineIds.has(d.id));
    if (filter === "review") return review;
    return [...all].sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));
  }, [all, filter, offlineIds, review]);

  const startScan = async () => {
    const img = await capturePhoto();
    if (!img) return;
    setPendingImage(img);
    setScanSheet(true);
  };

  const togglePin = (doc: DocRow) => {
    if (offlineIds.has(doc.id)) unpin.mutate(doc.id);
    else pin.mutate(doc, { onError: () => Alert.alert(t("common:state.error", { ns: "common" })) });
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t("title")}</Text>
          <Pressable style={styles.scanBtn} onPress={startScan}>
            <Icon name="document_scanner" size={19} color={colors.textOnDark} />
            <Text style={styles.scanText}>{t("scan")}</Text>
          </Pressable>
        </View>
        <View style={{ marginTop: 13 }}>
          <SearchBar placeholder={t("searchPlaceholder")} value={query} onChangeText={setQuery} />
        </View>
        <View style={styles.chips}>
          <Chip label={t("filters.recent")} active={filter === "recent"} onPress={() => setFilter("recent")} />
          <Chip label={t("filters.offline")} active={filter === "offline"} onPress={() => setFilter("offline")} />
          <Chip label={t("filters.review")} active={filter === "review"} onPress={() => setFilter("review")} />
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandDark} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandDark} />}
        >
          {(offline.data ?? []).length > 0 ? (
            <View style={styles.offlineBanner}>
              <Icon name="offline_pin" size={21} color={colors.brandDeep} />
              <View style={{ flex: 1 }}>
                <Text style={styles.offlineTitle}>{t("offlineBanner", { count: offline.data!.length })}</Text>
                <Text style={styles.offlineSub}>{formatFileSize(storageUsed.data ?? 0)}</Text>
              </View>
            </View>
          ) : null}

          {filter === "recent" && review.length > 0 ? (
            <View>
              <SectionHeader label={t("awaitingReview", { count: review.length })} />
              <Card radius="lgXl" padded={false}>
                {review.map((doc, i) => (
                  <ReviewRow key={doc.id} doc={doc} isLast={i === review.length - 1} />
                ))}
              </Card>
            </View>
          ) : null}

          {list.length === 0 ? (
            <EmptyState icon="description" title={t("common:state.empty", { ns: "common" })} />
          ) : (
            <View>
              <SectionHeader label={t(filter === "recent" ? "recent" : `filters.${filter}`)} />
              <Card radius="lgXl" padded={false}>
                {list.map((doc, i) => (
                  <Pressable key={doc.id} style={[styles.docRow, i < list.length - 1 && styles.rowBorder]}>
                    <Icon name="description" size={22} color={colors.iconMuted} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.docName} numberOfLines={1}>
                        {doc.name}
                      </Text>
                      <Text style={styles.docMeta} numberOfLines={1}>
                        {[doc.matterReference, formatFileSize(doc.sizeBytes)].filter(Boolean).join(" · ")}
                      </Text>
                    </View>
                    <Pressable onPress={() => togglePin(doc)} hitSlop={8}>
                      <Icon
                        name={offlineIds.has(doc.id) ? "offline_pin" : "download"}
                        size={20}
                        color={offlineIds.has(doc.id) ? colors.brandBronze : colors.chevronMuted}
                      />
                    </Pressable>
                  </Pressable>
                ))}
              </Card>
            </View>
          )}
        </ScrollView>
      )}
      <FAB />

      <MatterPickerSheet
        visible={scanSheet}
        onClose={() => setScanSheet(false)}
        onPick={(matter) => {
          if (!pendingImage) return;
          const form = documentFormData(pendingImage, {
            name: `Scan ${formatDate(new Date())}`,
            matterId: matter.id,
            category: "Evidence",
          });
          upload.mutate(form, { onError: () => Alert.alert(t("common:state.error", { ns: "common" })) });
          setPendingImage(null);
        }}
      />
    </View>
  );
}

function ReviewRow({ doc, isLast }: { doc: DocRow; isLast: boolean }) {
  return (
    <View style={[styles.docRow, !isLast && styles.rowBorder]}>
      <View style={styles.thumb}>
        <Icon name="picture_as_pdf" size={20} color={colors.iconMuted} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.docName} numberOfLines={2}>
          {doc.name}
        </Text>
        <View style={styles.reviewMeta}>
          {doc.matterReference ? <MatterRefBadge reference={doc.matterReference} small /> : null}
          <StatusBadge label="Review" tone="warning" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { flex: 1, fontFamily: fontFamily.extrabold, fontSize: fontSize.displayLg, letterSpacing: -0.3, color: colors.textPrimary },
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: 38,
    paddingHorizontal: 13,
    borderRadius: radii.md,
    backgroundColor: colors.brandDark,
  },
  scanText: { fontFamily: fontFamily.bold, fontSize: fontSize.baseMd, color: colors.textOnDark },
  chips: { flexDirection: "row", gap: 8, marginTop: 13 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 20, gap: 14, paddingBottom: 100 },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: colors.brandAmberBannerBg,
    borderWidth: 1,
    borderColor: colors.brandCreamBorder,
    borderRadius: radii.lgXl,
    padding: 14,
  },
  offlineTitle: { fontFamily: fontFamily.extrabold, fontSize: fontSize.md, color: colors.brandAmberBannerText },
  offlineSub: { fontFamily: fontFamily.medium, fontSize: fontSize.smMd, color: colors.brandAmberBannerSubtext, marginTop: 2 },
  docRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 15, paddingVertical: 13 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderHairline },
  docName: { fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.textPrimary, lineHeight: 18 },
  docMeta: { fontFamily: fontFamily.semibold, fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 3 },
  thumb: {
    width: 40,
    height: 48,
    borderRadius: radii.sm,
    backgroundColor: colors.bgSunk,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewMeta: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 6 },
});
