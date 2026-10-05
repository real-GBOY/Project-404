import { AuthLayout } from "@/components/AuthLayout";
import { Field, TextInput } from "@/components/Field";
import { Notice } from "@/components/Notice";
import { useI18n } from "@/hooks/use-i18n";
import { FORM } from "@/styles/form-styles";
import { useForgotPassword } from "./use-forgot-password";

/** `/forgot-password`: ask for a reset link. */
export function ForgotPasswordPage() {
  const { i } = useI18n();
  const f = useForgotPassword();
  return (
    <AuthLayout>
      <form onSubmit={f.submit} style={FORM.card}>
        <h1 style={FORM.heading}>{i.S("acct_forgotTitle")}</h1>
        {f.done ? (
          <Notice tone="success" size="md">
            {i.S("acct_forgotDone")}
          </Notice>
        ) : (
          <>
            <p style={{ margin: 0 }}>{i.S("acct_forgotBody")}</p>
            <Field label={i.S("email")}>
              <TextInput
                type="email"
                autoComplete="username"
                required
                value={f.email}
                onChange={(e) => f.setEmail(e.target.value)}
              />
            </Field>
            {f.failed ? <Notice tone="danger">{i.S("acct_failed")}</Notice> : null}
            <button
              type="submit"
              disabled={f.busy}
              style={{ ...FORM.primaryButton, opacity: f.busy ? 0.7 : 1 }}
            >
              {i.S("acct_forgotSend")}
            </button>
          </>
        )}
        <a href="/" style={FORM.link}>
          {i.S("acct_toSignIn")}
        </a>
      </form>
    </AuthLayout>
  );
}
