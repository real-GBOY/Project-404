import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { colors, radii } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";
import { Icon } from "@/components/ui/Icon";
import { ConfirmActionCard } from "../components/ConfirmActionCard";

type Bubble =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string }
  | { role: "assistant-confirm" };

const SUGGESTIONS = ["Summarize 1042/2026", "What needs my review?"];

/**
 * The assistant has no backend (only an unused `aiAssistantEnabled` settings
 * flag). This screen implements the full designed interface — bubbles,
 * suggestion chips, composer, and the confirm-action card from screen 17 —
 * as a clearly-labelled preview. Sending a message returns one honest reply;
 * nothing is fabricated as a live answer.
 */
export default function AssistantScreen() {
  const { t } = useTranslation("assistant");
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState("");
  const [conversation, setConversation] = useState<Bubble[]>([
    { role: "user", text: "Schedule a follow-up hearing for case 1042" },
    { role: "assistant", text: "I can add this and notify the team. Check the details first." },
    { role: "assistant-confirm" },
  ]);

  const send = (text: string) => {
    const value = text.trim();
    if (!value) return;
    setConversation((c) => [...c, { role: "user", text: value }, { role: "assistant", text: t("notConnected") }]);
    setInput("");
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.avatar} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t("title")}</Text>
          <Text style={styles.headerSub}>{t("subtitleActions")}</Text>
        </View>
        <Pressable hitSlop={8}>
          <Icon name="history" size={23} color={colors.brandDeep} />
        </Pressable>
        <Pressable hitSlop={8} onPress={() => router.back()}>
          <Icon name="close" size={23} color={colors.brandDeep} />
        </Pressable>
      </View>

      <View style={styles.previewBanner}>
        <Icon name="auto_awesome" size={16} color={colors.brandDeep} />
        <Text style={styles.previewText}>{t("notConnected")}</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.conversation}>
          {conversation.map((b, i) => {
            if (b.role === "user") {
              return (
                <View key={i} style={styles.userRow}>
                  <Text style={styles.userBubble}>{b.text}</Text>
                </View>
              );
            }
            if (b.role === "assistant") {
              return (
                <View key={i} style={styles.assistantRow}>
                  <View style={styles.smallAvatar} />
                  <Text style={styles.assistantText}>{b.text}</Text>
                </View>
              );
            }
            return (
              <View key={i} style={styles.assistantRow}>
                <View style={styles.smallAvatar} />
                <View style={{ flex: 1 }}>
                  <ConfirmActionCard
                    icon="event_available"
                    title="Schedule hearing"
                    confirmLabel="Confirm & schedule"
                    fields={[
                      { label: "MATTER", value: "1042/2026" },
                      { label: "DATE & TIME", value: "Tue 8 Sep · 10:00" },
                      { label: "COURT", value: "Economic Court, Circuit 7" },
                      { label: "ATTENDING", value: "A. Tawfik, S. Ali" },
                    ]}
                    onConfirm={() => send("Confirm")}
                    onCancel={() => {}}
                  />
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {SUGGESTIONS.map((s) => (
              <Pressable key={s} style={styles.suggestChip} onPress={() => send(s)}>
                <Text style={styles.suggestChipText}>{s}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.inputRow}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={t("placeholder")}
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              onSubmitEditing={() => send(input)}
            />
            <Pressable hitSlop={6}>
              <Icon name="mic" size={22} color={colors.brandBronze} />
            </Pressable>
            <Pressable style={styles.sendBtn} onPress={() => send(input)}>
              <Icon name="send" size={19} color={colors.textOnDark} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  avatar: { width: 32, height: 32, borderRadius: radii.pill, backgroundColor: "#7A5138" },
  smallAvatar: { width: 26, height: 26, borderRadius: radii.pill, backgroundColor: "#7A5138" },
  headerTitle: { fontFamily: fontFamily.extrabold, fontSize: fontSize.xl, color: colors.textPrimary },
  headerSub: { fontFamily: fontFamily.medium, fontSize: fontSize.sm, color: colors.textSecondary },
  previewBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.brandAmberBannerBg,
    paddingHorizontal: 20,
    paddingVertical: 9,
  },
  previewText: { flex: 1, fontFamily: fontFamily.semibold, fontSize: fontSize.sm, color: colors.brandAmberBannerSubtext },
  conversation: { padding: 20, gap: 16 },
  userRow: { alignItems: "flex-end" },
  userBubble: {
    maxWidth: "80%",
    backgroundColor: colors.brandDark,
    color: colors.textOnDark,
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.mdLg,
    lineHeight: 20,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: radii.lgXl,
    borderBottomRightRadius: 6,
    overflow: "hidden",
  },
  assistantRow: { flexDirection: "row", gap: 10 },
  assistantText: { flex: 1, fontFamily: fontFamily.medium, fontSize: fontSize.mdLg, lineHeight: 22, color: colors.chatText },
  composer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  chipsRow: { gap: 8, paddingBottom: 11 },
  suggestChip: { borderWidth: 1, borderColor: colors.borderSectionRule, borderRadius: radii.pill, paddingHorizontal: 13, paddingVertical: 8 },
  suggestChipText: { fontFamily: fontFamily.semibold, fontSize: fontSize.base, color: colors.textPrimary },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.borderNeutral,
    borderRadius: radii.lgXl,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  input: { flex: 1, fontFamily: fontFamily.medium, fontSize: fontSize.mdLg, color: colors.textPrimary, padding: 0 },
  sendBtn: { width: 34, height: 34, borderRadius: radii.smMd, backgroundColor: colors.brandDark, alignItems: "center", justifyContent: "center" },
});
