import { useState } from "react";
import { api } from "@/api";
import type { SecurityStatus } from "@/api/types";
import { TextInput } from "@/components/Field";
import { useI18n } from "@/hooks/use-i18n";
import { messageFor } from "@/services/api-error";
import { C } from "@/styles/colors";
import { FORM } from "@/styles/form-styles";
import { FONT } from "@/styles/typography";
import { useSecurityAction, type Flash } from "./use-security-action";

const CODE_BOX = {
  background: C.surface.paper,
  border: `1px solid ${C.border.hairline}`,
  borderRadius: 4,
  padding: "10px 12px",
  fontFamily: FONT.mono,
} as const;

/** Two-step verification: enrol an authenticator app, keep the recovery codes, or turn it off. */
export function MfaSection({
  sec,
  onChanged,
  setFlash,
}: {
  sec: SecurityStatus;
  onChanged: () => Promise<void>;
  setFlash: (f: Flash | null) => void;
}) {
  const { i } = useI18n();
  const { busy, run } = useSecurityAction(setFlash);
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [off, setOff] = useState({ open: false, password: "", code: "" });
  const fail = (e: unknown, byCode: Record<string, string> = {}) =>
    messageFor(e, i.S("acct_failed"), byCode);

  const start = () =>
    run(
      async () => setSetup(await api.account.mfaSetup()),
      (e) => fail(e),
    );
  const confirm = () =>
    run(
      async () => {
        const r = await api.account.mfaEnable(code.trim());
        setRecovery(r.recoveryCodes);
        setSetup(null);
        setCode("");
        await onChanged();
      },
      (e) => fail(e, { "raqib.mfa_invalid": i.S("acct_otpInvalid") }),
    );
  const disable = () =>
    run(
      async () => {
        await api.account.mfaDisable(off.password, off.code.trim());
        setOff({ open: false, password: "", code: "" });
        await onChanged();
        setFlash({ ok: true, text: i.S("acct_saved") });
      },
      (e) =>
        fail(e, {
          "raqib.wrong_password": i.S("acct_pwWrong"),
          "raqib.mfa_invalid": i.S("acct_otpInvalid"),
          "raqib.mfa_required_by_policy": i.S("acct_mfaCannotDisable"),
        }),
    );

  return (
    <section style={FORM.card} aria-labelledby="mfa-h">
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h2 id="mfa-h" style={FORM.sectionHeading}>
          {i.S("acct_mfaTitle")}
        </h2>
        <span
          style={{
            fontSize: 12,
            borderRadius: 10,
            padding: "1px 9px",
            color: sec.mfa.enabled ? C.brand.primary : C.status.warning.strong,
            background: sec.mfa.enabled ? C.brand.tint : C.status.warning.bg,
          }}
        >
          {sec.mfa.enabled ? i.S("acct_mfaOn") : i.S("acct_mfaOff")}
        </span>
        {sec.mfa.required ? (
          <span style={{ fontSize: 12, color: C.text.secondary }}>
            {i.S("acct_mfaRequiredTag")}
          </span>
        ) : null}
      </div>
      <p style={{ margin: 0, color: C.text.body }}>{i.S("acct_mfaBody")}</p>

      {recovery ? (
        <div
          style={{
            ...CODE_BOX,
            fontFamily: FONT.sans,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <strong>{i.S("acct_mfaRecoveryTitle")}</strong>
          <span style={{ fontSize: 13, color: C.text.body }}>{i.S("acct_mfaRecoveryBody")}</span>
          <code
            dir="ltr"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2,minmax(0,1fr))",
              gap: 4,
              fontFamily: FONT.mono,
              fontSize: 14,
            }}
          >
            {recovery.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </code>
          <button style={FORM.primaryButton} onClick={() => setRecovery(null)}>
            {i.S("acct_mfaSaved")}
          </button>
        </div>
      ) : null}

      {!sec.mfa.enabled && !setup && !recovery ? (
        <button
          style={{ ...FORM.primaryButton, alignSelf: "flex-start" }}
          disabled={busy}
          onClick={() => void start()}
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
              ...CODE_BOX,
              userSelect: "all",
              fontSize: 15,
              letterSpacing: ".08em",
              wordBreak: "break-all",
            }}
          >
            {setup.secret.match(/.{1,4}/g)?.join(" ")}
          </code>
          <a href={setup.uri} style={{ fontSize: 13, color: C.brand.primary }}>
            {i.S("acct_mfaOpenApp")}
          </a>
          <span>{i.S("acct_mfaStep2")}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <TextInput
              aria-label={i.S("acct_otpLabel")}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={{ maxWidth: 160, letterSpacing: ".3em", textAlign: "center" }}
            />
            <button
              style={FORM.primaryButton}
              disabled={busy || code.replace(/\s/g, "").length < 6}
              onClick={() => void confirm()}
            >
              {i.S("acct_mfaConfirm")}
            </button>
          </div>
        </div>
      ) : null}

      {sec.mfa.enabled && !recovery ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 13, color: C.text.body }}>
            {i.S("acct_mfaRecoveryLeft", { n: sec.mfa.recoveryLeft })}
          </span>
          {sec.mfa.required ? (
            <span style={{ fontSize: 13, color: C.text.secondary }}>
              {i.S("acct_mfaCannotDisable")}
            </span>
          ) : off.open ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 13 }}>{i.S("acct_mfaDisableBody")}</span>
              <TextInput
                type="password"
                aria-label={i.S("password")}
                autoComplete="current-password"
                value={off.password}
                onChange={(e) => setOff({ ...off, password: e.target.value })}
              />
              <TextInput
                aria-label={i.S("acct_otpLabel")}
                autoComplete="one-time-code"
                value={off.code}
                onChange={(e) => setOff({ ...off, code: e.target.value })}
              />
              <button
                style={{ ...FORM.ghostButton, alignSelf: "flex-start" }}
                disabled={busy || !off.password || off.code.length < 6}
                onClick={() => void disable()}
              >
                {i.S("acct_mfaDisable")}
              </button>
            </div>
          ) : (
            <button
              style={{ ...FORM.ghostButton, alignSelf: "flex-start" }}
              onClick={() => setOff({ ...off, open: true })}
            >
              {i.S("acct_mfaDisable")}
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}
