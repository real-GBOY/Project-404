import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useAuth } from "@/lib/auth/use-auth";
import { isApiError } from "@/lib/api/api-error";
import { colors, radii } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { BronzeButton } from "@/components/ui/Button";
import { useDir } from "@/lib/i18n/use-dir";

export default function SignInScreen() {
  const { t } = useTranslation("auth");
  const insets = useSafeAreaInsets();
  const { isRtl } = useDir();
  const { login, unlockWithBiometrics, biometricAvailable, hasStoredSession, user } = useAuth();

  const [email, setEmail] = useState(process.env.EXPO_PUBLIC_DEMO_EMAIL ?? "");
  const [password, setPassword] = useState(process.env.EXPO_PUBLIC_DEMO_PASSWORD ?? "");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const outcome = await login(email.trim(), password);
      if (outcome.hasNoOrg) {
        setError(t("noOrganization"));
      } else {
        router.replace("/(tabs)/today");
      }
    } catch (err) {
      setError(
        isApiError(err) && err.isUnauthorized ? t("invalidCredentials") : t("invalidCredentials"),
      );
    } finally {
      setLoading(false);
    }
  };

  const tryBiometrics = async () => {
    setError(null);
    const ok = await unlockWithBiometrics();
    if (!ok) setError(t("biometricFailed"));
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 60, paddingBottom: Math.max(insets.bottom, 24) + 20 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.lockup}>
            <Logo size={52} tone="reversed" />
            <Text style={styles.wordmark}>{isRtl ? "ميزان" : "Mizan"}</Text>
          </View>
          <View style={styles.rule} />
          <Text style={styles.tagline}>{t("tagline")}</Text>

          <View style={styles.form}>
            <View>
              <Text style={styles.label}>{t("firmEmailLabel")}</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="username"
                  placeholder="name@firm.eg"
                  placeholderTextColor={colors.brandTan}
                  style={styles.input}
                />
              </View>
            </View>
            <View>
              <Text style={styles.label}>{t("passwordLabel")}</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  textContentType="password"
                  placeholder="••••••••••"
                  placeholderTextColor={colors.brandTan}
                  style={[styles.input, { flex: 1 }]}
                />
                <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                  <Icon name="visibility_off" size={20} color={colors.brandBronze} />
                </Pressable>
              </View>
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <BronzeButton
            label={loading ? t("signingIn") : t("signIn")}
            onPress={submit}
            loading={loading}
            disabled={!email || !password}
            style={{ marginTop: 26 }}
          />

          {biometricAvailable && hasStoredSession ? (
            <Pressable style={styles.faceIdRow} onPress={tryBiometrics} hitSlop={8}>
              <Icon name="face" size={20} color={colors.brandTan} />
              <Text style={styles.faceIdText}>{t("useFaceId")}</Text>
            </Pressable>
          ) : null}

          <View style={styles.footer}>
            {user ? <Text style={styles.footerName}>{user.displayName ?? user.email}</Text> : null}
            <Text style={styles.footerNotice}>{t("auditNotice")}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.brandDark },
  content: { flexGrow: 1, paddingHorizontal: 28 },
  lockup: { flexDirection: "row", alignItems: "center", gap: 18 },
  wordmark: {
    fontFamily: fontFamily.display,
    fontSize: 44,
    color: colors.textOnDark,
    letterSpacing: 1,
  },
  rule: { width: 72, height: 1, backgroundColor: colors.brandBronze, marginTop: 22 },
  tagline: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.hero,
    lineHeight: 38,
    color: colors.textOnDark,
    marginTop: 22,
    maxWidth: 300,
  },
  form: { marginTop: 44, gap: 16 },
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.smMd,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.brandTan,
    marginBottom: 8,
  },
  inputWrap: {
    height: 50,
    borderRadius: radii.md,
    backgroundColor: colors.brandDeep,
    borderWidth: 1,
    borderColor: colors.brandBorderDark,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 15,
  },
  input: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.lg,
    color: colors.textOnDark,
    padding: 0,
  },
  error: {
    marginTop: 14,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.baseMd,
    color: "#D98C7A",
  },
  faceIdRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 22,
  },
  faceIdText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    letterSpacing: 0.3,
    color: colors.brandTan,
  },
  footer: { marginTop: "auto", alignItems: "center", paddingTop: 40 },
  footerName: { fontFamily: fontFamily.semibold, fontSize: fontSize.base, color: colors.brandTan },
  footerNotice: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.smMd,
    color: colors.brandTan,
    marginTop: 6,
    textAlign: "center",
    lineHeight: 17,
  },
});
