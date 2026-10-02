import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Alert } from "@/lib/alert";
import { useRouter } from "expo-router";
import {
  Bar,
  Card,
  Icon,
  IconButton,
  Label,
  LimeButton,
  Num,
  Ring,
  type IconName,
} from "@/components/ui";
import { Screen } from "@/components/ui/Screen";
import { useSession } from "@/features/auth/session";
import { exerciseByName } from "@/features/training/catalog";
import { prsThisWeek, streak, trainedOn, weekVolumeKg } from "@/features/training/metrics";
import { useTraining } from "@/features/training/store";
import { useUnits } from "@/features/training/units";
import { addDays, greeting, isSameDay, startOfWeek, weekdayName, WEEKDAY_SHORT } from "@/lib/dates";
import { colors, em } from "@/theme/tokens";
import { fonts } from "@/theme/typography";

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());

export function HomeScreen() {
  const router = useRouter();
  const { user } = useSession();
  const { sessions, prs, todayPlan, workout, startWorkout } = useTraining();
  const units = useUnits();
  const now = new Date();

  const week = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(now), i));
  const [selected, setSelected] = useState(() => week.findIndex((d) => isSameDay(d, now)));

  const total = todayPlan.exercises.length;
  const done = workout ? workout.exercises.filter((e) => e.sets.length > 0).length : 0;

  const stats: { num: string; unit?: string; label: string; icon: IconName }[] = [
    { num: String(streak(sessions, now)), label: "Day Streak", icon: "flame" },
    {
      num: (weekVolumeKg(sessions, now) / 1000).toFixed(1),
      unit: "T",
      label: "Volume",
      icon: "layers",
    },
    { num: String(prsThisWeek(prs, now)), label: "PRs / Week", icon: "trophy" },
  ];

  const last = sessions[0];
  const lastPr = last
    ? (prs[last.top.name]?.kg ?? exerciseByName(last.top.name)?.prKg ?? last.top.kg)
    : 0;

  const begin = () => {
    startWorkout();
    router.push("/workout");
  };

  const firstName = user?.name.split(" ")[0] ?? "";

  return (
    <Screen tabBarClearance gap={20}>
      {/* header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.hello}>{greeting(now)}</Text>
          <Text style={styles.name}>{firstName}</Text>
        </View>
        <View style={styles.headerRight}>
          <View>
            <IconButton
              label="Notifications"
              size={44}
              radius={14}
              onPress={() => Alert.alert("Notifications", "You're all caught up.")}
            >
              <Icon name="bell" size={21} color={colors.ink} />
            </IconButton>
            <View style={styles.bellDot} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            onPress={() => router.navigate("/profile")}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
          </Pressable>
        </View>
      </View>

      {/* weekly strip */}
      <View style={styles.week}>
        {week.map((day, i) => {
          const active = i === selected;
          const trained = trainedOn(sessions, day);
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`${weekdayName(day)} ${day.getDate()}`}
              onPress={() => setSelected(i)}
              style={styles.weekDay}
            >
              <Text style={[styles.weekLetter, { color: active ? colors.ink : colors.sub }]}>
                {WEEKDAY_SHORT[i]}
              </Text>
              <View style={[styles.weekCircle, active && styles.weekCircleOn]}>
                <Num size={18} color={active || trained ? colors.ink : colors.sub}>
                  {day.getDate()}
                </Num>
                {trained && !active ? <View style={styles.weekDot} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* today's session */}
      <Card dark style={{ padding: 20, overflow: "hidden" }}>
        <View style={styles.ring}>
          <Ring value={done} total={total} size={58} stroke={5}>
            <View style={{ flexDirection: "row", alignItems: "baseline" }}>
              <Num size={24} color="#fff">
                {done}
              </Num>
              <Text style={styles.ringTotal}>/{total}</Text>
            </View>
          </Ring>
        </View>
        <Label color="rgba(255,255,255,0.45)" size={10}>
          Today's Session
        </Label>
        <Text style={styles.sessionName}>{todayPlan.name}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{total} exercises</Text>
          <View style={styles.metaDot} />
          <Text style={styles.meta}>{todayPlan.minutes} min</Text>
        </View>
        <View style={styles.segments}>
          {todayPlan.exercises.map((e, i) => (
            <View
              key={e.id}
              style={[
                styles.segment,
                { backgroundColor: i < done ? colors.lime : "rgba(255,255,255,0.14)" },
              ]}
            />
          ))}
        </View>
      </Card>

      {/* stats */}
      <View style={styles.statRow}>
        {stats.map((s) => (
          <Card key={s.label} style={styles.stat}>
            <View style={styles.statIcon}>
              <Icon name={s.icon} size={16} color={colors.limeDim} />
            </View>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 1 }}>
              <Num size={30}>{s.num}</Num>
              {s.unit ? (
                <Num size={18} color={colors.sub}>
                  {s.unit}
                </Num>
              ) : null}
            </View>
            <Label size={9.5} style={{ letterSpacing: em(9.5, 0.05) }}>
              {s.label}
            </Label>
          </Card>
        ))}
      </View>

      {/* last session */}
      {last ? (
        <View>
          <View style={styles.lastHead}>
            <Label color={colors.ink} size={11} weight="semi">
              Last Session
            </Label>
            <Text style={styles.lastMeta}>
              {weekdayName(new Date(last.date))} · {titleCase(last.day)}
            </Text>
          </View>
          <Card
            style={{ padding: 16 }}
            onPress={() =>
              router.push({ pathname: "/progress", params: { exercise: last.top.name } })
            }
          >
            <View style={styles.lastRow}>
              <View>
                <Text style={styles.lastName}>{last.top.name.toUpperCase()}</Text>
                <View style={styles.lastWeight}>
                  <Num size={32}>{units.show(last.top.kg)}</Num>
                  <Num size={16} color={colors.sub}>
                    {units.label}
                  </Num>
                  <Text style={styles.lastReps}>× {last.top.reps}</Text>
                </View>
              </View>
              {last.top.deltaKg > 0 ? (
                <View style={styles.delta}>
                  <Icon name="arrowUp" size={13} color={colors.limeDim} />
                  <Text style={styles.deltaText}>
                    +{units.show(last.top.deltaKg)}
                    {units.short}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={{ marginTop: 14 }}>
              <Bar pct={lastPr ? last.top.kg / lastPr : 0} />
              <View style={styles.barLabels}>
                <Text style={styles.barLabel}>
                  {Math.round(lastPr ? (last.top.kg / lastPr) * 100 : 0)}% to next PR
                </Text>
                <Text style={styles.barLabel}>
                  {units.show(lastPr)} {units.short}
                </Text>
              </View>
            </View>
          </Card>
        </View>
      ) : null}

      <View style={{ marginTop: 2 }}>
        <LimeButton
          label={workout ? "CONTINUE SESSION" : "START SESSION"}
          icon="play"
          iconPosition="left"
          height={58}
          fontSize={24}
          onPress={begin}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  hello: { fontFamily: fonts.body, fontSize: 12.5, color: colors.sub, letterSpacing: 0.25 },
  name: {
    fontFamily: fonts.bodySemi,
    fontSize: 19,
    color: colors.ink,
    marginTop: 2,
    letterSpacing: -0.19,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  bellDot: {
    position: "absolute",
    top: 11,
    right: 12,
    width: 7,
    height: 7,
    borderRadius: 99,
    backgroundColor: colors.lime,
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 99,
    backgroundColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.display, fontSize: 20, color: colors.lime, letterSpacing: 0.8 },
  week: { flexDirection: "row", justifyContent: "space-between", gap: 6 },
  weekDay: { flex: 1, alignItems: "center", gap: 8 },
  weekLetter: { fontFamily: fonts.bodyMedium, fontSize: 11 },
  weekCircle: {
    width: 38,
    height: 38,
    borderRadius: 99,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hair,
    alignItems: "center",
    justifyContent: "center",
  },
  weekCircleOn: {
    backgroundColor: colors.lime,
    borderColor: colors.lime,
    shadowColor: colors.limeDim,
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  weekDot: {
    position: "absolute",
    bottom: -1,
    width: 5,
    height: 5,
    borderRadius: 99,
    backgroundColor: colors.lime,
  },
  ring: { position: "absolute", top: 18, right: 18 },
  ringTotal: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    marginLeft: 1,
  },
  sessionName: {
    fontFamily: fonts.display,
    fontSize: 38,
    lineHeight: 40,
    color: "#fff",
    letterSpacing: em(38, 0.02),
    marginTop: 8,
    marginBottom: 4,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  meta: { fontFamily: fonts.body, fontSize: 12.5, color: "rgba(255,255,255,0.55)" },
  metaDot: { width: 3, height: 3, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.35)" },
  segments: { marginTop: 16, flexDirection: "row", gap: 6 },
  segment: { flex: 1, height: 4, borderRadius: 99 },
  statRow: { flexDirection: "row", gap: 12 },
  stat: { flex: 1, paddingTop: 14, paddingHorizontal: 12, paddingBottom: 13, gap: 9 },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: colors.limeTintStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  lastHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  lastMeta: { fontFamily: fonts.body, fontSize: 11, color: colors.sub },
  lastRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  lastName: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, letterSpacing: 0.44 },
  lastWeight: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 4 },
  lastReps: { fontFamily: fonts.body, fontSize: 12, color: colors.sub, marginLeft: 2 },
  delta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.limeTintStrong,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 99,
  },
  deltaText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.limeDeep },
  barLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 7 },
  barLabel: { fontFamily: fonts.body, fontSize: 10.5, color: colors.sub },
});
