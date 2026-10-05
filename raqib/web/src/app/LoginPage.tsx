import { useState, type FormEvent } from "react";
import { ApiError } from "@/config";
import { DEMO_MODE, DEMO_PASSWORD, ORG_SLUG } from "@/config";
import { DEMO_ACCOUNTS } from "@/config/demo-accounts";
import { useAuth } from "@/auth/auth-provider";
import { createI18n, saveLang } from "@/i18n/i18n";
import { setUi, useUi } from "@/state/ui-store";

const card = { background: "#fff", border: "1px solid #E3E1DA", borderRadius: 6 } as const;
const input = { height: 42, border: "1px solid #D6D3CB", borderRadius: 4, padding: "0 12px", fontSize: 14 } as const;

/**
 * Sign-in. The product design has no dedicated login screen, so this uses the approved design tokens (palette,
 * type, radii). In demo mode it also lists the seeded accounts for one-click sign-in.
 */
export function LoginPage() {
  const ui = useUi();
  const i = createI18n(ui.lang);
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const submit = async (e: FormEvent, em = email, pw = password) => {
    e.preventDefault();
    setBusy(true);
    setFailure(null);
    try {
      await auth.login(em.trim(), pw);
    } catch (err) {
      setFailure(err instanceof ApiError ? (err.status === 401 || err.status === 400 ? i.S("signInFailed") : err.message) : i.S("loadErrBody"));
    } finally {
      setBusy(false);
    }
  };
  const reason = auth.error === "session_expired" ? i.S("sessionExpired") : null;
  const setLang = (l: "ar" | "en") => {
    saveLang(l);
    setUi({ lang: l });
    document.documentElement.lang = l;
    document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
  };

  return (
    <div
      dir={i.dir}
      lang={ui.lang}
      style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "#F5F4F0", fontFamily: "'IBM Plex Sans Arabic','IBM Plex Sans',system-ui,sans-serif", color: "#191C1F", fontSize: 14 }}
    >
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, background: "#0F5C4A", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 20 }}>{i.t.logoMark}</div>
          <div style={{ lineHeight: 1.25 }}>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{i.t.brand}</div>
            <div style={{ fontSize: 12.5, color: "#5C6168" }}>{i.t.signInSub}</div>
          </div>
          <div style={{ marginInlineStart: "auto", display: "flex", border: "1px solid #D6D3CB", borderRadius: 4, overflow: "hidden" }}>
            {(["ar", "en"] as const).map((l) => (
              <button key={l} onClick={() => setLang(l)} style={{ border: 0, padding: "0 10px", height: 28, fontSize: 12, cursor: "pointer", background: ui.lang === l ? "#191C1F" : "#fff", color: ui.lang === l ? "#fff" : "#3D4247" }}>
                {l === "ar" ? "العربية" : "English"}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={submit} style={{ ...card, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{i.S("signIn")}</h1>
          {reason ? <div role="status" style={{ fontSize: 13, color: "#6B4600", background: "#FAEFD8", borderRadius: 4, padding: "8px 10px" }}>{reason}</div> : null}
          <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13, fontWeight: 500 }}>
            {i.S("email")}
            <input type="email" autoComplete="username" dir="ltr" required value={email} onChange={(e) => setEmail(e.target.value)} style={input} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13, fontWeight: 500 }}>
            {i.S("password")}
            <input type="password" autoComplete="current-password" dir="ltr" required value={password} onChange={(e) => setPassword(e.target.value)} style={input} />
          </label>
          {failure ? <div role="alert" style={{ fontSize: 13, color: "#A3262A" }}>{failure}</div> : null}
          <button type="submit" disabled={busy} style={{ height: 44, border: 0, borderRadius: 4, background: "#0F5C4A", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", opacity: busy ? 0.7 : 1 }}>
            {busy ? i.S("signingIn") : i.S("signIn")}
          </button>
        </form>
        <a href={`/request-account/${ORG_SLUG}`} style={{ fontSize: 13, color: "#0F5C4A", textAlign: "center" }}>{i.S("requestAccountLink")}</a>

        {DEMO_MODE ? (
          <div style={{ ...card, padding: 14 }}>
            <div style={{ fontSize: 12, color: "#5C6168", marginBottom: 8 }}>{i.S("signInDemo", { p: DEMO_PASSWORD })}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {DEMO_ACCOUNTS.map((a) => (
                <button key={a.email} type="button" disabled={busy} onClick={(e) => void submit(e as never, a.email, DEMO_PASSWORD)} style={{ textAlign: "start", border: "1px solid #E3E1DA", borderRadius: 4, background: "#FAF9F6", padding: "8px 10px", fontSize: 13, cursor: "pointer" }}>
                  <span style={{ fontWeight: 500 }}>{a.label[ui.lang]}</span>
                  <span dir="ltr" style={{ display: "block", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11.5, color: "#5C6168" }}>{a.email}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
