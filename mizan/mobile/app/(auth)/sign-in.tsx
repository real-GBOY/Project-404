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
import { useAuth } from "@/lib/auth/use-auth";
import { isApiError } from "@/lib/api/api-error";
import { colors, radii } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";
import { Icon } from "@/components/ui/Icon";
import { BronzeButton } from "@/components/ui/Button";

export default function SignInScreen() {
  const { t } = useTranslation("auth");
  const insets = useSafeAreaInsets();
  const { login, unlockWithBiometrics, biometricAvailable, hasStoredSession, user } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      }
      // needsOrgSelection: single-org accounts (the common case) resolve
      // automatically inside AuthProvider's token claims; a multi-org picker
      // is out of scope for this pass — falls through to the tab navigator,
      // where org-scoped data will simply reflect the account's default org.
    } catch (err) {
      setError(isApiError(err) && err.isUnauthorized ? t("invalidCredentials") : t("invalidCredentials"));
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
            { paddingTop: insets.top + 58, paddingBottom: Math.max(insets.bottom, 24) + 20 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logo}>
            <Text style={styles.logoText}>M</Text>
          </View>
          <Text style={styles.title}>{t("common:appName")}</Text>
          <Text style={styles.subtitle}>{t("firm")} · Cairo</Text>

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
                  placeholder="a.tawfik@tawfiklaw.eg"
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
                  <Icon
                    name="visibility_off"
                    size={20}
                    color={colors.brandBronze}
                  />
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
              <Icon name="face" size={22} color={colors.brandTan} />
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
  screen: {
    flex: 1,
    backgroundColor: colors.brandDark,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 28,
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.brandCream,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.displayLg,
    color: colors.brandDark,
  },
  title: {
    fontFamily: fontFamily.extrabold,
    fontSize: 30,
    color: colors.textOnDark,
    letterSpacing: -0.5,
    marginTop: 26,
    lineHeight: 36,
  },
  subtitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.lg,
    color: colors.brandTan,
    marginTop: 8,
  },
  form: {
    marginTop: 44,
    gap: 14,
  },
  label: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    letterSpacing: 0.7,
    color: colors.brandTan,
    marginBottom: 8,
  },
  inputWrap: {
    height: 52,
    borderRadius: radii.lg,
    backgroundColor: colors.brandDeep,
    borderWidth: 1,
    borderColor: colors.brandBorderDark,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.textOnDark,
    padding: 0,
  },
  error: {
    marginTop: 14,
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.baseMd,
    color: "#E8836B",
  },
  faceIdRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 22,
  },
  faceIdText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.brandTan,
  },
  footer: {
    marginTop: "auto",
    alignItems: "center",
    paddingTop: 40,
  },
  footerName: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    color: colors.brandTan,
  },
  footerNotice: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.smMd,
    color: colors.brandTan,
    marginTop: 6,
    textAlign: "center",
  },
});
