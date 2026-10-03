import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Icon, IconButton } from "@/components/ui";
import { Alert } from "@/lib/alert";
import { greeting } from "@/lib/dates";
import { colors, radii, space } from "@/theme/tokens";
import { fonts } from "@/theme/typography";

export function HomeHeader({ firstName, now }: { firstName: string; now: Date }) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.hello}>{greeting(now)}</Text>
        <Text style={styles.name}>{firstName}</Text>
      </View>
      <View style={styles.right}>
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
  right: { flexDirection: "row", alignItems: "center", gap: space.md },
  bellDot: {
    position: "absolute",
    top: 11,
    right: 12,
    width: 7,
    height: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.lime,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.display, fontSize: 20, color: colors.lime, letterSpacing: 0.8 },
});
