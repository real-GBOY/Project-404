import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api";
import type { Me } from "@/api/types";
import { DEMO_MODE, DEMO_PASSWORD } from "@/config";
import { useAuth } from "@/features/auth/auth-context";
import { useI18n } from "@/hooks/use-i18n";
import { tokenStore } from "@/services/http";
import { setUi } from "@/state/ui-store";
import { C } from "@/styles/colors";
import { FORM } from "@/styles/form-styles";
import { DEMO_ACCOUNTS } from "./demo-accounts";

/**
 * Demo mode only, on My settings: sign in as another seeded role. Each switch is a real sign-out + sign-in against the
 * backend; there is no client-side impersonation.
 */
export function DemoAccountSwitcher({ me }: { me: Me }) {
  const auth = useAuth();
  const { i, lang } = useI18n();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  if (!DEMO_MODE) return null;
  const current = DEMO_ACCOUNTS.find((a) => a.email === me.email)?.email ?? "";

  const switchTo = async (email: string) => {
    if (!email || email === me.email) return;
    setBusy(true);
    try {
      const previous = tokenStore.getRefresh();
      await auth.login(email, DEMO_PASSWORD); // a real sign-in; replaces the session and clears cached data
      if (previous) api.auth.logout(previous).catch(() => undefined);
      setUi({ modal: null, notif: false, more: false, search: false });
      navigate("/overview");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={FORM.card} aria-labelledby="acct-demo-h">
      <h2 id="acct-demo-h" style={FORM.sectionHeading}>
        {i.S("acct_demo")}
      </h2>
      <span style={{ fontSize: 13, color: C.text.secondary }}>{i.S("acct_demoBody")}</span>
      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
        {i.S("acct_demoLabel")}
        <select
          value={current}
          disabled={busy}
          onChange={(e) => void switchTo(e.target.value)}
          style={{ ...FORM.input, maxWidth: 420 }}
        >
          {current ? null : <option value="">{me.email}</option>}
          {DEMO_ACCOUNTS.map((a) => (
            <option key={a.email} value={a.email}>
              {a.label[lang]}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
