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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import { formatDate, formatTime, formatMoneyList, formatRelative } from "@/lib/format";
import { colors, radii } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MatterRefBadge } from "@/components/ui/MatterRefBadge";
import { StickyFooterBar } from "@/components/ui/StickyFooterBar";
import { PrimaryButton, IconButton } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { useMatter, useMatterUpdates, useMatterNotes, useMatterMutations } from "../hooks";
import { matterStatusFromRaw, MATTER_STATUS_LABEL } from "../presentation";
import { useHearingList } from "@/features/hearings/hooks";
import { useTaskList } from "@/features/tasks/hooks";
import { useDocumentList, useDocumentMutations } from "@/features/documents/hooks";

const TABS = ["overview", "hearings", "tasks", "files", "notes"] as const;
type Tab = (typeof TABS)[number];

export default function CaseDetailScreen() {
  const { matterId } = useLocalSearchParams<{ matterId: string }>();
  const id = String(matterId);
  const { t } = useTranslation("matters");
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("overview");
  const [noteSheet, setNoteSheet] = useState(false);
  const [noteText, setNoteText] = useState("");

  const { data: matter, isLoading } = useMatter(id);
  const { addNote } = useMatterMutations(id);
  const { upload } = useDocumentMutations();

  const status = matter ? matterStatusFromRaw(matter.status) : "active";

  const captureDocument = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const form = new FormData();
    form.append("file", {
      uri: asset.uri,
      name: asset.fileName ?? `scan-${Date.now()}.jpg`,
      type: asset.mimeType ?? "image/jpeg",
    } as unknown as Blob);
    form.append("name", asset.fileName ?? `Scan ${formatDate(new Date())}`);
    form.append("matterId", id);
    form.append("category", "Evidence");
    upload.mutate(form, {
      onError: () => Alert.alert(t("common:state.error", { ns: "common" })),
    });
  };

  const saveNote = () => {
    if (noteText.trim()) {
      addNote.mutate({ body: noteText.trim() });
      setNoteText("");
    }
    setNoteSheet(false);
  };

  if (isLoading || !matter) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brandDark} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Icon name="arrow_back" size={24} color={colors.brandCream} />
          </Pressable>
          <Text style={styles.headerRef}>{matter.reference}</Text>
          <Pressable onPress={() => router.push("/assistant")} hitSlop={8}>
            <Icon name="auto_awesome" size={23} color={colors.brandCream} />
          </Pressable>
          <Pressable onPress={() => {}} hitSlop={8}>
            <Icon name="more_vert" size={23} color={colors.brandCream} />
          </Pressable>
        </View>
        <Text style={styles.headerTitle}>{matter.title}</Text>
        <Text style={styles.headerSubtitle} numberOfLines={2}>
          {[matter.court, matter.value.length ? formatMoneyList(matter.value).join(" · ") : null]
            .filter(Boolean)
            .join(" · ")}
        </Text>
        <View style={styles.headerChips}>
          <DarkChip label={MATTER_STATUS_LABEL[status]} />
          <DarkChip label={matter.practiceArea} />
        </View>
      </View>

      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarContent}>
          {TABS.map((tk) => (
            <Pressable key={tk} onPress={() => setTab(tk)} style={styles.tabItem}>
              <Text style={[styles.tabLabel, tab === tk && styles.tabLabelActive]}>{t(`tabs.${tk}`)}</Text>
              {tab === tk ? <View style={styles.tabUnderline} /> : null}
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={{ flex: 1 }}>
        {tab === "overview" ? <OverviewTab id={id} /> : null}
        {tab === "hearings" ? <HearingsTab id={id} /> : null}
        {tab === "tasks" ? <TasksTab id={id} /> : null}
        {tab === "files" ? <FilesTab id={id} /> : null}
        {tab === "notes" ? <NotesTab id={id} /> : null}
      </View>

      <StickyFooterBar>
        <PrimaryButton
          label={t("logTime")}
          icon="timer"
          onPress={() => router.push({ pathname: "/capture/log-time", params: { matterId: id } })}
          style={{ flex: 1, height: 46 }}
        />
        <IconButton icon="photo_camera" variant="outline" size={46} onPress={captureDocument} />
        <IconButton icon="note_add" variant="outline" size={46} onPress={() => setNoteSheet(true)} />
      </StickyFooterBar>

      <BottomSheet visible={noteSheet} onClose={() => setNoteSheet(false)}>
        <Text style={styles.sheetTitle}>{t("tabs.notes")}</Text>
        <TextInput
          value={noteText}
          onChangeText={setNoteText}
          multiline
          placeholder={t("tabs.notes")}
          placeholderTextColor={colors.textSecondary}
          style={styles.noteInput}
        />
        <PrimaryButton label={t("common:actions.save", { ns: "common" })} onPress={saveNote} style={{ marginTop: 12 }} />
      </BottomSheet>
    </View>
  );
}

function DarkChip({ label }: { label: string }) {
  return (
    <View style={styles.darkChip}>
      <Text style={styles.darkChipText}>{label}</Text>
    </View>
  );
}

function OverviewTab({ id }: { id: string }) {
  const { t } = useTranslation("matters");
  const hearings = useHearingList({ matterId: id, scope: "upcoming" });
  const tasks = useTaskList({ matterId: id, status: "todo" });
  const updates = useMatterUpdates(id);

  const nextHearing = hearings.data?.items?.[0];
  const deadlines = (tasks.data?.items ?? []).filter((tk) => tk.dueAt).sort((a, b) => (a.dueAt! < b.dueAt! ? -1 : 1));

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      {nextHearing ? (
        <Card radius="lgXl">
          <View style={styles.hearingRow}>
            <DateChip iso={nextHearing.scheduledAt} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{nextHearing.purpose || t("tabs.hearings")}</Text>
              <Text style={styles.rowSub}>
                {formatTime(nextHearing.scheduledAt)} · {nextHearing.court} · {nextHearing.leadLawyer}
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      {deadlines.length > 0 ? (
        <View>
          <SectionHeader label={t("openDeadlines")} />
          <Card radius="lgXl" padded={false}>
            {deadlines.map((tk, i) => (
              <View key={tk.id} style={[styles.deadlineRow, i < deadlines.length - 1 && styles.rowBorder]}>
                <View style={[styles.accent, { backgroundColor: tk.overdue ? colors.dangerAccent : colors.warningAccent }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{tk.title}</Text>
                  <Text style={styles.rowSub}>{tk.assignee ?? formatDate(tk.dueAt!)}</Text>
                </View>
                <StatusBadge
                  label={tk.overdue ? "overdue" : formatRelative(tk.dueAt!)}
                  tone={tk.overdue ? "danger" : "warning"}
                />
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      <View>
        <SectionHeader label={t("history")} />
        <Card radius="lgXl">
          {updates.isLoading ? (
            <ActivityIndicator color={colors.brandDark} />
          ) : (updates.data ?? []).length === 0 ? (
            <Text style={styles.rowSub}>{t("common:state.empty", { ns: "common" })}</Text>
          ) : (
            (updates.data ?? []).map((u, i, arr) => (
              <View key={u.id} style={styles.timelineRow}>
                <View style={styles.timelineGutter}>
                  <View style={styles.timelineDot}>
                    <Icon name="gavel" size={16} color={colors.brandDeep} />
                  </View>
                  {i < arr.length - 1 ? <View style={styles.timelineLine} /> : null}
                </View>
                <View style={{ flex: 1, paddingBottom: i < arr.length - 1 ? 15 : 0 }}>
                  <Text style={styles.rowTitle}>{u.body.split("\n")[0]}</Text>
                  <Text style={styles.rowSub}>
                    {u.author} · {formatDate(u.createdAt)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </Card>
      </View>
    </ScrollView>
  );
}

function DateChip({ iso }: { iso: string }) {
  const d = new Date(iso);
  return (
    <View style={styles.dateChip}>
      <Text style={styles.dateChipMonth}>{d.toLocaleDateString("en-US", { month: "short" }).toUpperCase()}</Text>
      <Text style={styles.dateChipDay}>{d.getDate()}</Text>
    </View>
  );
}

function HearingsTab({ id }: { id: string }) {
  const { data, isLoading } = useHearingList({ matterId: id });
  const { t } = useTranslation("matters");
  if (isLoading) return <Loading />;
  const items = data?.items ?? [];
  if (items.length === 0) return <EmptyState icon="gavel" title={t("common:state.empty", { ns: "common" })} />;
  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      {items.map((h) => (
        <Pressable key={h.id} onPress={() => router.push(`/hearings/${h.id}`)}>
          <Card radius="lgXl">
            <View style={styles.hearingRow}>
              <DateChip iso={h.scheduledAt} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{h.purpose || t("tabs.hearings")}</Text>
                <Text style={styles.rowSub}>
                  {formatTime(h.scheduledAt)} · {h.court}
                </Text>
              </View>
              <StatusBadge label={h.status} tone={h.status === "decided" ? "success" : "neutral"} />
            </View>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function TasksTab({ id }: { id: string }) {
  const { data, isLoading } = useTaskList({ matterId: id });
  const { t } = useTranslation("matters");
  if (isLoading) return <Loading />;
  const items = data?.items ?? [];
  if (items.length === 0) return <EmptyState icon="task_alt" title={t("common:state.empty", { ns: "common" })} />;
  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <Card radius="lgXl" padded={false}>
        {items.map((tk, i) => (
          <View key={tk.id} style={[styles.deadlineRow, i < items.length - 1 && styles.rowBorder]}>
            <View style={[styles.checkbox, tk.status === "done" && styles.checkboxDone]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, tk.status === "done" && styles.strike]}>{tk.title}</Text>
              {tk.dueAt ? <Text style={styles.rowSub}>{formatDate(tk.dueAt)}</Text> : null}
            </View>
            {tk.priority === "high" ? <StatusBadge label="High" tone="danger" /> : null}
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

function FilesTab({ id }: { id: string }) {
  const { data, isLoading } = useDocumentList({ matterId: id });
  const { t } = useTranslation("matters");
  if (isLoading) return <Loading />;
  const items = data?.items ?? [];
  if (items.length === 0) return <EmptyState icon="description" title={t("common:state.empty", { ns: "common" })} />;
  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <Card radius="lgXl" padded={false}>
        {items.map((doc, i) => (
          <View key={doc.id} style={[styles.deadlineRow, i < items.length - 1 && styles.rowBorder]}>
            <Icon name="description" size={22} color={colors.iconMuted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {doc.name}
              </Text>
              <Text style={styles.rowSub}>{doc.category}</Text>
            </View>
            <StatusBadge label={doc.status} tone="neutral" />
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

function NotesTab({ id }: { id: string }) {
  const { data, isLoading } = useMatterNotes(id);
  const { t } = useTranslation("matters");
  if (isLoading) return <Loading />;
  const items = data ?? [];
  if (items.length === 0) return <EmptyState icon="note_add" title={t("common:state.empty", { ns: "common" })} />;
  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      {items.map((n) => (
        <Card key={n.id} radius="lgXl">
          <Text style={styles.noteBody}>{n.body}</Text>
          <Text style={[styles.rowSub, { marginTop: 8 }]}>
            {n.author} · {formatDate(n.createdAt)}
          </Text>
        </Card>
      ))}
    </ScrollView>
  );
}

function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.brandDark} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  header: { backgroundColor: colors.brandDark, paddingHorizontal: 20, paddingBottom: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerRef: { flex: 1, fontFamily: fontFamily.mono, fontWeight: "700", fontSize: fontSize.lg, color: colors.textOnDark },
  headerTitle: { fontFamily: fontFamily.extrabold, fontSize: fontSize.xxl, lineHeight: 23, color: colors.textOnDark, marginTop: 14 },
  headerSubtitle: { fontFamily: fontFamily.medium, fontSize: fontSize.baseMd, color: colors.brandTan, marginTop: 6 },
  headerChips: { flexDirection: "row", gap: 8, marginTop: 14, flexWrap: "wrap" },
  darkChip: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: radii.pill, backgroundColor: colors.brandDeep },
  darkChipText: { fontFamily: fontFamily.bold, fontSize: fontSize.smMd, color: colors.brandCream },
  tabBar: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabBarContent: { paddingHorizontal: 20, gap: 22 },
  tabItem: { paddingVertical: 13 },
  tabLabel: { fontFamily: fontFamily.semibold, fontSize: fontSize.mdLg, color: colors.textSecondary },
  tabLabelActive: { fontFamily: fontFamily.extrabold, color: colors.brandDark },
  tabUnderline: { position: "absolute", bottom: 0, left: 0, right: 0, height: 2.5, backgroundColor: colors.brandBronze, borderRadius: 2 },
  tabContent: { padding: 20, gap: 14, paddingBottom: 40 },
  hearingRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  dateChip: { backgroundColor: colors.brandCream, borderRadius: radii.md, paddingHorizontal: 11, paddingVertical: 8, alignItems: "center" },
  dateChipMonth: { fontFamily: fontFamily.extrabold, fontSize: fontSize.xs, color: colors.brandBronzeLabel },
  dateChipDay: { fontFamily: fontFamily.extrabold, fontSize: fontSize.xxl, color: colors.brandDark, lineHeight: 19 },
  rowTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.textPrimary },
  rowSub: { fontFamily: fontFamily.medium, fontSize: fontSize.base, color: colors.textSecondary, marginTop: 3 },
  deadlineRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 15, paddingVertical: 13 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderHairline },
  accent: { width: 3, alignSelf: "stretch", borderRadius: radii.pill },
  checkbox: { width: 22, height: 22, borderWidth: 2, borderColor: colors.borderNeutral, borderRadius: radii.xs },
  checkboxDone: { backgroundColor: colors.brandBronze, borderColor: colors.brandBronze },
  strike: { textDecorationLine: "line-through", color: colors.textSecondary },
  timelineRow: { flexDirection: "row", gap: 12 },
  timelineGutter: { alignItems: "center" },
  timelineDot: { width: 30, height: 30, borderRadius: radii.pill, backgroundColor: colors.brandCream, alignItems: "center", justifyContent: "center" },
  timelineLine: { width: 1.5, flex: 1, backgroundColor: colors.chipInactiveBg, minHeight: 12 },
  noteBody: { fontFamily: fontFamily.medium, fontSize: fontSize.md, color: colors.chatTextAlt, lineHeight: 20 },
  sheetTitle: { fontFamily: fontFamily.extrabold, fontSize: fontSize.display, color: colors.textPrimary, letterSpacing: -0.2 },
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
