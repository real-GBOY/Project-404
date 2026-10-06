import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api";
import type { Lang, Me } from "@/api/types";
import { LanguageSegments } from "@/components/LanguageSegments";
import { DEMO_MODE, DEMO_PASSWORD } from "@/config";
import { useAuth } from "@/features/auth/auth-context";
import { tokenStore } from "@/services/http";
import { setUi } from "@/state/ui-store";
import { C } from "@/styles/colors";
import { FORM } from "@/styles/form-styles";
import { FONT } from "@/styles/typography";
import { DEMO_ACCOUNTS } from "./demo-accounts";

const SELECT = {
  height: 28,
  background: C.chrome.bgAlt,
  color: C.brand.onDark,
  border: `1px solid ${C.chrome.line}`,
  borderRadius: 4,
  padding: "0 6px",
  fontSize: 12,
} as const;

/**
 * Presenter bar (demo mode only): switch language, or sign in as another seeded role. Each switch is a real sign-out + sign-in
 * against the backend; there is no client-side impersonation.
 */
export function DemoBar({ me, lang }: { me: Me; lang: Lang }) {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
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
    <div
      dir="ltr"
      style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: "8px 16px",
        flexWrap: "wrap",
        padding: "7px 14px",
        background: C.chrome.bgDeep,
        color: C.chrome.textMuted,
        fontFamily: FONT.latin,
        fontSize: 12,
      }}
    >
      <span
        style={{
          fontFamily: FONT.mono,
          color: C.brand.onDark,
          letterSpacing: ".1em",
          fontSize: 11,
        }}
      >
        RAQIB · PRESENTER
      </span>
      <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
        Signed in as
        <select
          value={current}
          disabled={busy}
          onChange={(e) => void switchTo(e.target.value)}
          style={SELECT}
        >
          {current ? null : <option value="">{me.email}</option>}
          {DEMO_ACCOUNTS.map((a) => (
            <option key={a.email} value={a.email}>
              {a.label.en}
            </option>
          ))}
        </select>
      </label>
      <LanguageSegments lang={lang} />
      <button
        onClick={() => navigate("/account")}
        style={{ ...FORM.barButton, height: 26, marginInlineStart: "auto" }}
      >
        Settings
      </button>
      <button onClick={() => auth.logout()} style={{ ...FORM.barButton, height: 26 }}>
        Sign out
      </button>
    </div>
  );
}
