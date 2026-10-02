import { useState, type ReactNode } from "react";
import { Alert } from "@/lib/alert";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon, type IconName } from "@/components/ui";
import { colors, dark, em } from "@/theme/tokens";
import { fonts } from "@/theme/typography";

export function BrandMark({ size = 30, stacked = false }: { size?: number; stacked?: boolean }) {
  return (
    <View
      style={{
        alignItems: "center",
        flexDirection: stacked ? "column" : "row",
        gap: stacked ? 10 : 9,
      }}
    >
      <View
        style={{
          width: size + 14,
          height: size + 14,
          borderRadius: 14,
          backgroundColor: "rgba(200,255,0,0.12)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="dumbbellLogo" size={size} color={colors.lime} />
      </View>
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: size * 1.25,
          color: "#fff",
          letterSpacing: em(size * 1.25, 0.06),
        }}
      >
        FLUX
      </Text>
    </View>
  );
}

type FieldProps = {
  icon: IconName;
  secure?: boolean;
} & Pick<
  TextInputProps,
  | "placeholder"
  | "value"
  | "onChangeText"
  | "keyboardType"
  | "autoCapitalize"
  | "autoComplete"
  | "returnKeyType"
  | "onSubmitEditing"
>;

export function AuthField({ icon, secure, ...input }: FieldProps) {
  const [focus, setFocus] = useState(false);
  const [show, setShow] = useState(false);
  return (
    <View style={[styles.field, focus && { borderColor: colors.lime }]}>
      <Icon name={icon} size={18} color={focus ? colors.lime : dark.sub} />
      <TextInput
        {...input}
        accessibilityLabel={input.placeholder}
        secureTextEntry={secure && !show}
        placeholderTextColor={dark.sub}
        selectionColor={colors.lime}
        autoCorrect={false}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={styles.input}
      />
      {secure ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={show ? "Hide password" : "Show password"}
          onPress={() => setShow((s) => !s)}
          hitSlop={10}
        >
          <Icon name="eye" size={18} color={show ? colors.lime : dark.sub} />
        </Pressable>
      ) : null}
    </View>
  );
}

const notAvailable = () =>
  Alert.alert(
    "Not available yet",
    "Social sign-in isn't connected in this build. Use email for now.",
  );

export function SocialRow() {
  const items: { icon: IconName; label: string }[] = [
    { icon: "google", label: "Google" },
    { icon: "instagram", label: "Instagram" },
    { icon: "facebook", label: "Facebook" },
  ];
  return (
    <View style={styles.socialRow}>
      {items.map((it) => (
        <Pressable
          key={it.label}
          accessibilityRole="button"
          accessibilityLabel={`Continue with ${it.label}`}
          onPress={notAvailable}
          style={styles.social}
        >
          <Icon name={it.icon} size={22} color={colors.lime} />
        </Pressable>
      ))}
    </View>
  );
}

export function OrDivider() {
  return (
    <View style={styles.orRow}>
      <View style={styles.orLine} />
      <Text style={styles.orText}>OR</Text>
      <View style={styles.orLine} />
    </View>
  );
}

export function SegToggle<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; text: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={styles.toggle}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => onChange(o.value)}
              style={[styles.toggleBtn, on && { backgroundColor: colors.lime }]}
            >
              <Text style={[styles.toggleText, on && { color: colors.ink }]}>{o.text}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="alert" style={styles.error}>
      {children}
    </Text>
  );
}

/** Dark full-screen scaffold with keyboard avoidance for the auth forms. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.shell}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.shellContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function SwitchLink({
  prompt,
  action,
  onPress,
}: {
  prompt: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8} style={styles.switchLink}>
      <Text style={styles.switchPrompt}>{prompt} </Text>
      <Text style={styles.switchAction}>{action}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    height: 54,
    borderRadius: 14,
    backgroundColor: dark.field,
    borderWidth: 1,
    borderColor: dark.fieldBorder,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 12,
  },
  input: { flex: 1, color: "#fff", fontFamily: fonts.body, fontSize: 14, padding: 0 },
  socialRow: { flexDirection: "row", gap: 14, justifyContent: "center" },
  social: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: dark.field,
    borderWidth: 1,
    borderColor: dark.line,
    alignItems: "center",
    justifyContent: "center",
  },
  orRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  orLine: { flex: 1, height: 1, backgroundColor: dark.line },
  orText: { fontFamily: fonts.body, fontSize: 11, color: dark.sub, letterSpacing: 1.1 },
  toggleLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: dark.sub,
    marginBottom: 7,
    letterSpacing: 0.44,
  },
  toggle: {
    flexDirection: "row",
    backgroundColor: dark.field,
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: dark.fieldBorder,
  },
  toggleBtn: {
    flex: 1,
    height: 38,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleText: { fontFamily: fonts.bodySemi, fontSize: 13, color: dark.sub },
  error: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: "#FF6B6B", marginTop: 12 },
  shell: { flex: 1, backgroundColor: dark.bg },
  shellContent: { flexGrow: 1, paddingHorizontal: 26, paddingBottom: 30 },
  switchLink: { flexDirection: "row", justifyContent: "center", paddingTop: 22 },
  switchPrompt: { fontFamily: fonts.body, fontSize: 13, color: dark.sub },
  switchAction: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.lime },
});
