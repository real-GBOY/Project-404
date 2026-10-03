import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Alert } from "@/lib/alert";
import { useRouter } from "expo-router";
import { LimeButton } from "@/components/ui";
import { colors, dark, em } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import {
  AuthField,
  AuthShell,
  BrandMark,
  ErrorText,
  OrDivider,
  SocialRow,
  SwitchLink,
} from "../components";
import { useSession } from "../session";

export function SignInScreen() {
  const router = useRouter();
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const res = signIn(email, password);
    if (!res.ok) setError(res.error);
    // Success flips the session; the (auth) guard sends us to /home (or /onboarding if unfinished).
  };

  return (
    <AuthShell>
      <View style={styles.brand}>
        <BrandMark size={26} stacked />
      </View>
      <Text style={styles.title}>WELCOME BACK</Text>
      <Text style={styles.sub}>Pick up right where you left off.</Text>
      <View style={{ gap: 12 }}>
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
          autoComplete="current-password"
          returnKeyType="done"
          onSubmitEditing={submit}
        />
      </View>
      <Pressable
        accessibilityRole="link"
        hitSlop={8}
        style={styles.forgot}
        onPress={() =>
          Alert.alert(
            "Reset password",
            "Password reset needs the FLUX backend, which isn't connected yet.",
          )
        }
      >
        <Text style={styles.forgotText}>Forgot password?</Text>
      </Pressable>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <View style={{ marginTop: 22 }}>
        <LimeButton label="SIGN IN" onPress={submit} />
      </View>
      <View style={{ marginVertical: 22 }}>
        <OrDivider />
      </View>
      <SocialRow />
      <View style={{ flex: 1 }} />
      <SwitchLink
        prompt="New to FLUX?"
        action="Create account"
        onPress={() => router.replace("/sign-up")}
      />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: "center", paddingTop: 30, paddingBottom: 30 },
  title: {
    fontFamily: fonts.display,
    fontSize: 38,
    lineHeight: 42,
    color: colors.white,
    letterSpacing: em(38, 0.03),
    textAlign: "center",
    marginBottom: 6,
  },
  sub: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    color: dark.sub,
    textAlign: "center",
    marginBottom: 26,
  },
  forgot: { alignSelf: "flex-end", marginTop: 12 },
  forgotText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.lime },
});
