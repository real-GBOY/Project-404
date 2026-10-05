import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/raqib";
import type { Lang, Me } from "@/api/types";
import { useAuth } from "@/auth/auth-provider";
import { DEMO_MODE, DEMO_PASSWORD, tokenStore } from "@/config";
import { DEMO_ACCOUNTS } from "@/config/demo-accounts";
import { saveLang } from "@/i18n/i18n";
import { seg } from "@/presenters/common";
import { setUi } from "@/state/ui-store";

/**
 * Presenter bar (demo mode only): switch language, or sign in as another seeded role. Each switch is a real
 * sign-out + sign-in against the backend — there is no client-side impersonation.
 */
export function DemoBar({ me, lang }: { me: Me; lang: Lang }) {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  if (!DEMO_MODE) return null;
  const current = DEMO_ACCOUNTS.find((a) => a.email === me.email)?.email ?? "";
  const setLang = (l: Lang) => {
    saveLang(l);
    setUi({ lang: l });
  };
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
  const barSelect = {
    height: 28,
    background: "#18201E",
    color: "#E8EEEB",
    border: "1px solid #2A3431",
    borderRadius: 4,
    padding: "0 6px",
    fontSize: 12,
  } as const;
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
        background: "#0B0F0E",
        color: "#9AA6A1",
        fontFamily: "'IBM Plex Sans',system-ui,sans-serif",
        fontSize: 12,
      }}
    >
      <span
        style={{
          fontFamily: "'IBM Plex Mono',monospace",
          color: "#E8EEEB",
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
          style={barSelect}
        >
          {current ? null : <option value="">{me.email}</option>}
          {DEMO_ACCOUNTS.map((a) => (
            <option key={a.email} value={a.email}>
              {a.label.en}
            </option>
          ))}
        </select>
      </label>
      <div
        style={{
          display: "flex",
          border: "1px solid #2A3431",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        {(["ar", "en"] as const).map((l) => {
          const s = seg(lang, l, l === "ar" ? "العربية" : "English", () => setLang(l), true);
          return (
            <button
              key={l}
              onClick={s.set}
              style={{
                border: 0,
                padding: "0 10px",
                height: 26,
                fontSize: 12,
                cursor: "pointer",
                background: s.bg,
                color: s.fg,
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>
      <button
        onClick={() => auth.logout()}
        style={{
          height: 26,
          padding: "0 10px",
          border: "1px solid #2A3431",
          borderRadius: 4,
          fontSize: 12,
          cursor: "pointer",
          color: "#E8EEEB",
          background: "transparent",
          marginInlineStart: "auto",
        }}
      >
        Sign out
      </button>
    </div>
  );
}
