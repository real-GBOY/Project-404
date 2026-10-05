import { useState, type FormEvent } from "react";
import { api } from "@/api";
import type { SecurityStatus } from "@/api/types";
import { Field, TextInput } from "@/components/Field";
import { Notice } from "@/components/Notice";
import { useI18n } from "@/hooks/use-i18n";
import { messageFor } from "@/services/api-error";
import { C } from "@/styles/colors";
import { FORM } from "@/styles/form-styles";
import { useAuth } from "@/features/auth/auth-context";
import { useSecurityAction, type Flash } from "./use-security-action";

/** Change the password. The backend ends every session on success, so the person signs in again with the new one. */
export function PasswordSection({
  sec,
  setFlash,
}: {
  sec: SecurityStatus;
  setFlash: (f: Flash | null) => void;
}) {
  const { i } = useI18n();
  const auth = useAuth();
  const { busy, run } = useSecurityAction(setFlash);
  const [pw, setPw] = useState({ current: "", next: "" });
  const minLength = Math.max(10, sec.password.minLength); // the backend's own floor is 10

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(
      async () => {
        await api.account.changePassword(pw.current, pw.next);
        setPw({ current: "", next: "" });
        auth.logout("password_changed");
      },
      (err) =>
        messageFor(err, i.S("acct_failed"), {
          "raqib.wrong_password": i.S("acct_pwWrong"),
          "raqib.password_too_short": i.S("acct_pwShort", { n: sec.password.minLength }),
        }),
    );
  };

  return (
    <form onSubmit={submit} style={FORM.card} aria-labelledby="pw-h">
      <h2 id="pw-h" style={FORM.sectionHeading}>
        {i.S("acct_pwTitle")}
      </h2>
      <span style={{ fontSize: 13, color: C.text.secondary }}>
        {sec.password.changedAt
          ? i.S("acct_pwChanged", { d: i.fd(sec.password.changedAt, "full") })
          : i.S("acct_pwNever")}
      </span>
      {sec.password.expired ? (
        <Notice tone="warning">{i.S("acct_pwExpired", { n: sec.password.rotateDays })}</Notice>
      ) : null}
      <Field label={i.S("acct_pwCurrent")}>
        <TextInput
          type="password"
          autoComplete="current-password"
          required
          value={pw.current}
          onChange={(e) => setPw({ ...pw, current: e.target.value })}
        />
      </Field>
      <Field label={i.S("acct_pwNew")} hint={i.S("acct_pwRule", { n: minLength })}>
        <TextInput
          type="password"
          autoComplete="new-password"
          required
          minLength={minLength}
          value={pw.next}
          onChange={(e) => setPw({ ...pw, next: e.target.value })}
        />
      </Field>
      <button
        type="submit"
        disabled={busy}
        style={{ ...FORM.primaryButton, alignSelf: "flex-start", opacity: busy ? 0.7 : 1 }}
      >
        {i.S("acct_pwSave")}
      </button>
    </form>
  );
}
