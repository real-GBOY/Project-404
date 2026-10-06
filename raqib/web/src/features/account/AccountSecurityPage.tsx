import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { Notice } from "@/components/Notice";
import { useAuth } from "@/features/auth/auth-context";
import { useI18n } from "@/hooks/use-i18n";
import { FORM } from "@/styles/form-styles";
import { MfaSection } from "./MfaSection";
import { PasswordSection } from "./PasswordSection";
import { SessionsSection } from "./SessionsSection";
import type { Flash } from "./use-security-action";

/**
 * `/account/security`: second factor, password, sessions. Also what the app shows *instead of the workspace* while the
 * organization still requires a step (`forced`): the backend refuses everything else until it is done.
 */
export function AccountSecurityPage({ forced }: { forced?: boolean }) {
  const { i } = useI18n();
  const auth = useAuth();
  const navigate = useNavigate();
  const [flash, setFlash] = useState<Flash | null>(null);
  const sec = auth.security;

  if (!sec) {
    return (
      <AuthLayout wide>
        <div role="status" style={FORM.card}>
          …
        </div>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout wide>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h1 style={{ ...FORM.heading, fontSize: 20 }}>{i.S("acct_title")}</h1>
        <div style={{ marginInlineStart: "auto", display: "flex", gap: 8 }}>
          {forced ? null : (
            <button style={FORM.ghostButton} onClick={() => navigate("/")}>
              {i.S("acct_back")}
            </button>
          )}
          <button style={FORM.ghostButton} onClick={() => auth.logout()}>
            {i.S("acct_signOut")}
          </button>
        </div>
      </div>
      {forced ? (
        <Notice tone="warning" size="md">
          {i.S("acct_required")}
        </Notice>
      ) : null}
      {flash ? <Notice tone={flash.ok ? "success" : "danger"}>{flash.text}</Notice> : null}
      <MfaSection sec={sec} onChanged={auth.refreshSecurity} setFlash={setFlash} />
      <PasswordSection sec={sec} setFlash={setFlash} />
      {forced ? null : <SessionsSection sec={sec} setFlash={setFlash} />}
    </AuthLayout>
  );
}
