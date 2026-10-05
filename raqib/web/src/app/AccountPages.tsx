import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/raqib";
import type { Me } from "@/api/types";
import { useAuth } from "@/auth/auth-provider";
import { ApiError } from "@/config";
import { createI18n, saveLang } from "@/i18n/i18n";
import { setUi, useUi } from "@/state/ui-store";

const card: CSSProperties = {
  background: "#fff",
  border: "1px solid #E3E1DA",
  borderRadius: 6,
  padding: 20,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};
const input: CSSProperties = {
  height: 42,
  border: "1px solid #D6D3CB",
  borderRadius: 4,
  padding: "0 12px",
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
};
const primary: CSSProperties = {
  height: 42,
  border: 0,
  borderRadius: 4,
  background: "#0F5C4A",
  color: "#fff",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  padding: "0 18px",
};
const ghost: CSSProperties = {
  height: 36,
  border: "1px solid #D6D3CB",
  borderRadius: 4,
  background: "#fff",
  color: "#191C1F",
  fontSize: 13,
  cursor: "pointer",
  padding: "0 14px",
};
const FONT = "'IBM Plex Sans Arabic','IBM Plex Sans',system-ui,sans-serif";

function Shell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  const ui = useUi();
  const i = useMemo(() => createI18n(ui.lang), [ui.lang]);
  useEffect(() => {
    document.documentElement.lang = ui.lang;
    document.documentElement.dir = i.dir;
  }, [ui.lang, i.dir]);
  const setLang = (l: "ar" | "en") => {
    saveLang(l);
    setUi({ lang: l });
  };
  return (
    <div
      dir={i.dir}
      lang={ui.lang}
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        padding: 16,
        background: "#F5F4F0",
        fontFamily: FONT,
        color: "#191C1F",
        fontSize: 14,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: wide ? 640 : 420,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          alignSelf: "flex-start",
          marginTop: "6vh",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              background: "#0F5C4A",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 700,
              fontSize: 18,
            }}
          >
            {i.t.logoMark}
          </div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{i.t.brand}</div>
          <div
            style={{
              marginInlineStart: "auto",
              display: "flex",
              border: "1px solid #D6D3CB",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            {(["ar", "en"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                style={{
                  border: 0,
                  padding: "0 10px",
                  height: 28,
                  fontSize: 12,
                  cursor: "pointer",
                  background: ui.lang === l ? "#191C1F" : "#fff",
                  color: ui.lang === l ? "#fff" : "#3D4247",
                }}
              >
                {l === "ar" ? "العربية" : "English"}
              </button>
            ))}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

/** `/forgot-password` — ask for a reset link. The answer never says whether the address is registered. */
export function ForgotPasswordPage() {
  const ui = useUi();
  const i = useMemo(() => createI18n(ui.lang), [ui.lang]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [failure, setFailure] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFailure(false);
    try {
      await api.auth.forgot(email.trim());
      setDone(true);
    } catch (err) {
      // a rate-limit or network problem is shown; an unknown address never produces an error
      setFailure(!(err instanceof ApiError && err.status < 500 && err.status !== 429));
      if (err instanceof ApiError && err.status < 500 && err.status !== 429) setDone(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell>
      <form onSubmit={submit} style={card}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{i.S("acct_forgotTitle")}</h1>
        {done ? (
          <div
            role="status"
            style={{
              fontSize: 13.5,
              color: "#0F5C4A",
              background: "#E6F2EE",
              borderRadius: 4,
              padding: "10px 12px",
            }}
          >
            {i.S("acct_forgotDone")}
          </div>
        ) : (
          <>
            <p style={{ margin: 0, color: "#3D4247" }}>{i.S("acct_forgotBody")}</p>
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 5,
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {i.S("email")}
              <input
                type="email"
                autoComplete="username"
                dir="ltr"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={input}
              />
            </label>
            {failure ? (
              <div role="alert" style={{ color: "#A3262A", fontSize: 13 }}>
                {i.S("acct_failed")}
              </div>
            ) : null}
            <button type="submit" disabled={busy} style={{ ...primary, opacity: busy ? 0.7 : 1 }}>
              {i.S("acct_forgotSend")}
            </button>
          </>
        )}
        <a href="/" style={{ fontSize: 13, color: "#0F5C4A", textAlign: "center" }}>
          {i.S("acct_toSignIn")}
        </a>
      </form>
    </Shell>
  );
}

/** A slim bar for real (non-demo) sessions: who is signed in, the account page, sign out. */
export function AccountBar({ me }: { me: Me }) {
  const auth = useAuth();
  const ui = useUi();
  const i = useMemo(() => createI18n(ui.lang), [ui.lang]);
  const navigate = useNavigate();
  return (
    <div
      style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "5px 14px",
        background: "#0B0F0E",
        color: "#9AA6A1",
        fontSize: 12,
        fontFamily: FONT,
      }}
    >
      <span style={{ color: "#E8EEEB" }}>{i.L(me.name)}</span>
      <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11 }}>
        {me.email}
      </span>
      <button
        onClick={() => navigate("/account/security")}
        style={{
          marginInlineStart: "auto",
          height: 24,
          padding: "0 10px",
          border: "1px solid #2A3431",
          borderRadius: 4,
          fontSize: 12,
          cursor: "pointer",
          color: "#E8EEEB",
          background: "transparent",
        }}
      >
        {i.S("acct_title")}
      </button>
      <button
        onClick={() => auth.logout()}
        style={{
          height: 24,
          padding: "0 10px",
          border: "1px solid #2A3431",
          borderRadius: 4,
          fontSize: 12,
          cursor: "pointer",
          color: "#E8EEEB",
          background: "transparent",
        }}
      >
        {i.S("acct_signOut")}
      </button>
    </div>
  );
}

const errText = (e: unknown, fallback: string, map: Record<string, string> = {}): string =>
  e instanceof ApiError ? (map[e.code] ?? fallback) : fallback;

/**
 * `/account/security` — second factor, password, sessions. Also what the app shows *instead of the workspace* while the
 * organization still requires a step (`forced`): the backend refuses everything else until it is done.
 */
export function AccountSecurityPage({ forced }: { forced?: boolean }) {
  const ui = useUi();
  const i = useMemo(() => createI18n(ui.lang), [ui.lang]);
  const auth = useAuth();
  const navigate = useNavigate();
  const sec = auth.security;
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "" });
  const [off, setOff] = useState({ open: false, password: "", code: "" });

  const run = async (fn: () => Promise<void>, onError: (e: unknown) => string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg({ ok: false, text: onError(e) });
    } finally {
      setBusy(false);
    }
  };

  if (!sec)
    return (
      <Shell wide>
        <div role="status" style={card}>
          …
        </div>
      </Shell>
    );

  const startMfa = () =>
    run(
      async () => setSetup(await api.account.mfaSetup()),
      (e) => errText(e, i.S("acct_failed")),
    );
  const confirmMfa = () =>
    run(
      async () => {
        const r = await api.account.mfaEnable(code.trim());
        setRecovery(r.recoveryCodes);
        setSetup(null);
        setCode("");
        await auth.refreshSecurity();
      },
      (e) => errText(e, i.S("acct_failed"), { "raqib.mfa_invalid": i.S("acct_otpInvalid") }),
    );
  const disableMfa = () =>
    run(
      async () => {
        await api.account.mfaDisable(off.password, off.code.trim());
        setOff({ open: false, password: "", code: "" });
        await auth.refreshSecurity();
        setMsg({ ok: true, text: i.S("acct_saved") });
      },
      (e) =>
        errText(e, i.S("acct_failed"), {
          "raqib.wrong_password": i.S("acct_pwWrong"),
          "raqib.mfa_invalid": i.S("acct_otpInvalid"),
          "raqib.mfa_required_by_policy": i.S("acct_mfaCannotDisable"),
        }),
    );
  const changePw = (e: FormEvent) => {
    e.preventDefault();
    void run(
      async () => {
        await api.account.changePassword(pw.current, pw.next);
        setPw({ current: "", next: "" });
        // the backend ended every session including this one's refresh token: sign in again with the new password
        auth.logout("password_changed");
      },
      (err) =>
        errText(err, i.S("acct_failed"), {
          "raqib.wrong_password": i.S("acct_pwWrong"),
          "raqib.password_too_short": i.S("acct_pwShort", { n: sec.password.minLength }),
        }),
    );
  };
  const revoke = () =>
    run(
      async () => {
        await api.account.revokeSessions();
        setMsg({ ok: true, text: i.S("acct_sessDone") });
      },
      (e) => errText(e, i.S("acct_failed")),
    );

  const flash = msg ? (
    <div
      role={msg.ok ? "status" : "alert"}
      style={{
        fontSize: 13,
        borderRadius: 4,
        padding: "8px 10px",
        color: msg.ok ? "#0F5C4A" : "#A3262A",
        background: msg.ok ? "#E6F2EE" : "#FBE9E9",
      }}
    >
      {msg.text}
    </div>
  ) : null;

  return (
    <Shell wide>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{i.S("acct_title")}</h1>
        <div style={{ marginInlineStart: "auto", display: "flex", gap: 8 }}>
          {forced ? null : (
            <button style={ghost} onClick={() => navigate("/")}>
              {i.S("acct_back")}
            </button>
          )}
          <button style={ghost} onClick={() => auth.logout()}>
            {i.S("acct_signOut")}
          </button>
        </div>
      </div>
      {forced ? (
        <div
          role="alert"
          style={{
            fontSize: 13.5,
            color: "#6B4600",
            background: "#FAEFD8",
            borderRadius: 4,
            padding: "10px 12px",
          }}
        >
          {i.S("acct_required")}
        </div>
      ) : null}
      {flash}

      <section style={card} aria-labelledby="mfa-h">
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <h2 id="mfa-h" style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
            {i.S("acct_mfaTitle")}
          </h2>
          <span
            style={{
              fontSize: 12,
              borderRadius: 10,
              padding: "1px 9px",
              color: sec.mfa.enabled ? "#0F5C4A" : "#6B4600",
              background: sec.mfa.enabled ? "#E6F2EE" : "#FAEFD8",
            }}
          >
            {sec.mfa.enabled ? i.S("acct_mfaOn") : i.S("acct_mfaOff")}
          </span>
          {sec.mfa.required ? (
            <span style={{ fontSize: 12, color: "#5C6168" }}>{i.S("acct_mfaRequiredTag")}</span>
          ) : null}
        </div>
        <p style={{ margin: 0, color: "#3D4247" }}>{i.S("acct_mfaBody")}</p>

        {recovery ? (
          <div
            style={{
              background: "#FAF9F6",
              border: "1px solid #E3E1DA",
              borderRadius: 4,
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <strong>{i.S("acct_mfaRecoveryTitle")}</strong>
            <span style={{ fontSize: 13, color: "#3D4247" }}>{i.S("acct_mfaRecoveryBody")}</span>
            <code
              dir="ltr"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2,minmax(0,1fr))",
                gap: 4,
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 14,
              }}
            >
              {recovery.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </code>
            <button style={primary} onClick={() => setRecovery(null)}>
              {i.S("acct_mfaSaved")}
            </button>
          </div>
        ) : null}

        {!sec.mfa.enabled && !setup && !recovery ? (
          <button
            style={{ ...primary, alignSelf: "flex-start" }}
            disabled={busy}
            onClick={() => void startMfa()}
          >
            {i.S("acct_mfaStart")}
          </button>
        ) : null}

        {setup ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span>{i.S("acct_mfaStep1")}</span>
            <code
              dir="ltr"
              style={{
                userSelect: "all",
                background: "#FAF9F6",
                border: "1px solid #E3E1DA",
                borderRadius: 4,
                padding: "10px 12px",
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 15,
                letterSpacing: ".08em",
                wordBreak: "break-all",
              }}
            >
              {setup.secret.match(/.{1,4}/g)?.join(" ")}
            </code>
            <a href={setup.uri} style={{ fontSize: 13, color: "#0F5C4A" }}>
              {i.S("acct_mfaOpenApp")}
            </a>
            <span>{i.S("acct_mfaStep2")}</span>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                aria-label={i.S("acct_otpLabel")}
                inputMode="numeric"
                autoComplete="one-time-code"
                dir="ltr"
                maxLength={7}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                style={{ ...input, maxWidth: 160, letterSpacing: ".3em", textAlign: "center" }}
              />
              <button
                style={primary}
                disabled={busy || code.replace(/\s/g, "").length < 6}
                onClick={() => void confirmMfa()}
              >
                {i.S("acct_mfaConfirm")}
              </button>
            </div>
          </div>
        ) : null}

        {sec.mfa.enabled && !recovery ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 13, color: "#3D4247" }}>
              {i.S("acct_mfaRecoveryLeft", { n: sec.mfa.recoveryLeft })}
            </span>
            {sec.mfa.required ? (
              <span style={{ fontSize: 13, color: "#5C6168" }}>{i.S("acct_mfaCannotDisable")}</span>
            ) : off.open ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 13 }}>{i.S("acct_mfaDisableBody")}</span>
                <input
                  type="password"
                  aria-label={i.S("password")}
                  autoComplete="current-password"
                  dir="ltr"
                  value={off.password}
                  onChange={(e) => setOff({ ...off, password: e.target.value })}
                  style={input}
                />
                <input
                  aria-label={i.S("acct_otpLabel")}
                  autoComplete="one-time-code"
                  dir="ltr"
                  value={off.code}
                  onChange={(e) => setOff({ ...off, code: e.target.value })}
                  style={input}
                />
                <button
                  style={{ ...ghost, alignSelf: "flex-start" }}
                  disabled={busy || !off.password || off.code.length < 6}
                  onClick={() => void disableMfa()}
                >
                  {i.S("acct_mfaDisable")}
                </button>
              </div>
            ) : (
              <button
                style={{ ...ghost, alignSelf: "flex-start" }}
                onClick={() => setOff({ ...off, open: true })}
              >
                {i.S("acct_mfaDisable")}
              </button>
            )}
          </div>
        ) : null}
      </section>

      <form onSubmit={changePw} style={card} aria-labelledby="pw-h">
        <h2 id="pw-h" style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
          {i.S("acct_pwTitle")}
        </h2>
        <span style={{ fontSize: 13, color: "#5C6168" }}>
          {sec.password.changedAt
            ? i.S("acct_pwChanged", { d: i.fd(sec.password.changedAt, "full") })
            : i.S("acct_pwNever")}
        </span>
        {sec.password.expired ? (
          <div
            role="alert"
            style={{
              fontSize: 13,
              color: "#6B4600",
              background: "#FAEFD8",
              borderRadius: 4,
              padding: "8px 10px",
            }}
          >
            {i.S("acct_pwExpired", { n: sec.password.rotateDays })}
          </div>
        ) : null}
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 5,
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {i.S("acct_pwCurrent")}
          <input
            type="password"
            autoComplete="current-password"
            dir="ltr"
            required
            value={pw.current}
            onChange={(e) => setPw({ ...pw, current: e.target.value })}
            style={input}
          />
        </label>
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 5,
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {i.S("acct_pwNew")}
          <input
            type="password"
            autoComplete="new-password"
            dir="ltr"
            required
            minLength={Math.max(10, sec.password.minLength)}
            value={pw.next}
            onChange={(e) => setPw({ ...pw, next: e.target.value })}
            style={input}
          />
          <span style={{ fontWeight: 400, color: "#5C6168" }}>
            {i.S("acct_pwRule", { n: Math.max(10, sec.password.minLength) })}
          </span>
        </label>
        <button
          type="submit"
          disabled={busy}
          style={{ ...primary, alignSelf: "flex-start", opacity: busy ? 0.7 : 1 }}
        >
          {i.S("acct_pwSave")}
        </button>
      </form>

      {forced ? null : (
        <section style={card} aria-labelledby="sess-h">
          <h2 id="sess-h" style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
            {i.S("acct_sessTitle")}
          </h2>
          <span style={{ color: "#3D4247" }}>{i.S("acct_sessBody")}</span>
          {sec.sessionMinutes > 0 ? (
            <span style={{ fontSize: 13, color: "#5C6168" }}>
              {i.S("acct_idleNote", { n: sec.sessionMinutes })}
            </span>
          ) : null}
          <button
            style={{ ...ghost, alignSelf: "flex-start" }}
            disabled={busy}
            onClick={() => void revoke()}
          >
            {i.S("acct_sessRevoke")}
          </button>
        </section>
      )}
    </Shell>
  );
}
