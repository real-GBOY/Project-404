import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Alert } from "@/lib/alert";
import { useRouter } from "expo-router";
import { LimeButton } from "@/components/ui";
import { em } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import {
  AuthField,
  AuthShell,
  BrandMark,
  ErrorText,
  OrDivider,
  SegToggle,
  SocialRow,
  SwitchLink,
} from "../components";
import { useSession, type Language, type WeightUnit } from "../session";

const UNITS = [
  { value: "KG", text: "KG" },
  { value: "LBS", text: "LBS" },
] as const;
const LANGS = [
  { value: "EN", text: "EN" },
  { value: "AR", text: "عربي" },
] as const;

export function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [units, setUnits] = useState<WeightUnit>("KG");
  const [language, setLanguage] = useState<Language>("EN");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const res = signUp({ name, email, password, units, language });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (language === "AR") {
      Alert.alert("Arabic", "Arabic interface text is coming soon — your choice is saved.");
    }
    // Success flips the session to "needsOnboarding"; the (auth) guard redirects to /onboarding.
  };

  return (
    <AuthShell>
      <View style={styles.brand}>
        <BrandMark size={22} />
      </View>
      <Text style={styles.title}>CREATE ACCOUNT</Text>
      <View style={{ gap: 12 }}>
        <AuthField
          icon="user"
          placeholder="Full name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoComplete="name"
          returnKeyType="next"
        />
        <AuthField
          icon="mail"
          placeholder="Email address"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          returnKeyType="next"
        />
        <AuthField
          icon="lock"
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secure
          autoCapitalize="none"
          autoComplete="new-password"
          returnKeyType="done"
          onSubmitEditing={submit}
        />
      </View>
      <View style={styles.toggles}>
        <SegToggle label="Units" options={UNITS} value={units} onChange={setUnits} />
        <SegToggle label="Language" options={LANGS} value={language} onChange={setLanguage} />
      </View>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <View style={{ marginTop: 20 }}>
        <LimeButton label="CREATE ACCOUNT" onPress={submit} />
      </View>
      <View style={{ marginVertical: 20 }}>
        <OrDivider />
      </View>
      <SocialRow />
      <View style={{ flex: 1 }} />
      <SwitchLink
        prompt="Already have an account?"
        action="Sign in"
        onPress={() => router.replace("/sign-in")}
      />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: "center", paddingTop: 14, paddingBottom: 22 },
  title: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 38,
    color: "#fff",
    letterSpacing: em(34, 0.03),
    marginBottom: 18,
  },
  toggles: { flexDirection: "row", gap: 12, marginTop: 16 },
});
