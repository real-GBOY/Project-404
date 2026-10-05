import { AuthLayout } from "@/components/AuthLayout";
import { Field, TextInput } from "@/components/Field";
import { Notice } from "@/components/Notice";
import { ORG_SLUG } from "@/config";
import { DemoAccountsPicker } from "@/features/demo/DemoAccountsPicker";
import { useI18n } from "@/hooks/use-i18n";
import { FORM } from "@/styles/form-styles";
import { useLoginForm } from "./use-login-form";

/**
 * Sign-in. The product design has no dedicated login screen, so this uses the approved design tokens (palette, type, radii).
 * In demo mode it also lists the seeded accounts for one-click sign-in.
 */
export function LoginPage() {
  const { i } = useI18n();
  const f = useLoginForm();
  return (
    <AuthLayout centered tagline>
      <form onSubmit={f.submit} style={FORM.card}>
        <h1 style={FORM.heading}>{i.S("signIn")}</h1>
        {f.reason ? <Notice tone="warning">{f.reason}</Notice> : null}
        <Field label={i.S("email")}>
          <TextInput
            type="email"
            autoComplete="username"
            required
            value={f.email}
            onChange={(e) => f.setEmail(e.target.value)}
          />
        </Field>
        <Field label={i.S("password")}>
          <TextInput
            type="password"
            autoComplete="current-password"
            required
            value={f.password}
            onChange={(e) => f.setPassword(e.target.value)}
          />
        </Field>
        {f.needOtp ? (
          <Field label={i.S("acct_otpLabel")} hint={i.S("acct_otpHint")}>
            <TextInput
              inputMode="text"
              autoComplete="one-time-code"
              required
              ref={(el) => el?.focus()}
              value={f.otp}
              onChange={(e) => f.setOtp(e.target.value)}
            />
          </Field>
        ) : null}
        {f.failure ? <Notice tone="danger">{f.failure}</Notice> : null}
        <button
          type="submit"
          disabled={f.busy}
          style={{ ...FORM.primaryButton, height: 44, fontSize: 15, opacity: f.busy ? 0.7 : 1 }}
        >
          {f.busy ? i.S("signingIn") : i.S("signIn")}
        </button>
      </form>
      <a href="/forgot-password" style={FORM.link}>
        {i.S("acct_forgot")}
      </a>
      <a href={`/request-account/${ORG_SLUG}`} style={FORM.link}>
        {i.S("requestAccountLink")}
      </a>
      <DemoAccountsPicker busy={f.busy} onPick={(e, creds) => void f.submit(e, creds)} />
    </AuthLayout>
  );
}
