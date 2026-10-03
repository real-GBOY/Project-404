import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { Card, Icon, Label, LimeButton, Num, SectionLabel } from "@/components/ui";
import { Screen } from "@/components/ui/Screen";
import { useTraining } from "@/features/training/store";
import { useUnits } from "@/features/training/units";
import { colors } from "@/theme/tokens";
import { fonts } from "@/theme/typography";

export function SummaryScreen() {
  const router = useRouter();
  const units = useUnits();
  const { summary, clearSummary, saveNote } = useTraining();
  const [note, setNote] = useState("");
  if (!summary) return <Redirect href="/home" />;

  const done = () => {
    saveNote(note);
    clearSummary();
    router.replace("/home");
  };
  const stats = [
    { n: String(summary.exercises), l: "Exercises" },
    { n: String(summary.sets), l: "Sets" },
    { n: (summary.volumeKg / 1000).toFixed(1), u: "T", l: "Volume" },
  ];
  const pr = summary.prs[0];

  return (
    <Screen gap={18} contentStyle={{ paddingTop: 36 }}>
      <View style={{ alignItems: "center" }}>
        <Text style={styles.kicker}>WORKOUT COMPLETE</Text>
        <Text style={styles.title}>{summary.day}</Text>
        <Text style={styles.sub}>{summary.minutes} min · Today</Text>
      </View>

      <View style={styles.stats}>
        {stats.map((s) => (
          <Card key={s.l} style={styles.stat}>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2 }}>
              <Num size={24}>{s.n}</Num>
              {s.u ? (
                <Num size={13} color={colors.sub}>
                  {s.u}
                </Num>
              ) : null}
            </View>
            <Label size={9}>{s.l}</Label>
          </Card>
        ))}
      </View>

      {summary.replaced.length > 0 ? (
        <View style={{ gap: 4 }}>
          {summary.replaced.map((r) => (
            <Text key={r.from} style={styles.sub}>
              Replaced: {r.from} → {r.to}
            </Text>
          ))}
        </View>
      ) : null}

      <View>
        <SectionLabel>Progress</SectionLabel>
        <Card style={{ marginTop: 10, paddingHorizontal: 16 }}>
          {summary.progress.map((p, i) => (
            <View key={p.name}>
              <View style={styles.progRow}>
                <Text style={styles.progName}>{p.name}</Text>
                <Text
                  style={[
                    styles.badge,
                    p.delta.kind === "up" || p.delta.kind === "pr"
                      ? { color: colors.limeDeep, backgroundColor: colors.limeTintStrong }
                      : p.delta.kind === "down"
                        ? { color: colors.plateauTitle, backgroundColor: colors.plateauBg }
                        : { color: colors.sub, backgroundColor: colors.segment },
                  ]}
                >
                  {p.delta.label}
                </Text>
              </View>
              {i < summary.progress.length - 1 ? <View style={styles.hair} /> : null}
            </View>
          ))}
        </Card>
      </View>

      {pr ? (
        <Card dark style={styles.pr}>
          <View style={styles.prIcon}>
            <Icon name="trophy" size={20} color={colors.lime} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.prLabel}>
              Personal record{summary.prs.length > 1 ? `s · ${summary.prs.length}` : ""}
            </Text>
            <Text style={styles.prText}>
              {pr.name} — {units.show(pr.kg)} {units.short} × {pr.reps}
            </Text>
          </View>
        </Card>
      ) : null}

      <View style={styles.consistency}>
        <Icon name="flame" size={16} color={colors.limeDim} />
        <Text style={styles.sub}>
          {summary.weekCount} workout{summary.weekCount === 1 ? "" : "s"} this week ·{" "}
          {summary.streak}-day streak
        </Text>
      </View>

      <View>
        <SectionLabel>How did this workout feel?</SectionLabel>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Optional note…"
          placeholderTextColor={colors.sub}
          multiline
          style={styles.note}
        />
      </View>

      <LimeButton label="DONE" icon={null} fontSize={21} onPress={done} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.limeDim, letterSpacing: 2 },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.ink,
    letterSpacing: 0.64,
    marginTop: 6,
  },
  sub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.sub, marginTop: 2 },
  stats: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, paddingVertical: 14, paddingHorizontal: 8, alignItems: "center", gap: 6 },
  progRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  progName: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13.5, color: colors.ink },
  badge: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 99,
    overflow: "hidden",
  },
  hair: { height: 1, backgroundColor: colors.hair },
  pr: { padding: 16, flexDirection: "row", alignItems: "center", gap: 13 },
  prIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.limeA14,
    alignItems: "center",
    justifyContent: "center",
  },
  prLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.whiteA50 },
  prText: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.white, marginTop: 1 },
  consistency: { flexDirection: "row", alignItems: "center", gap: 10 },
  note: {
    marginTop: 10,
    minHeight: 64,
    borderWidth: 1,
    borderColor: colors.hair,
    borderRadius: 14,
    padding: 14,
    backgroundColor: colors.card,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ink,
    textAlignVertical: "top",
  },
});
