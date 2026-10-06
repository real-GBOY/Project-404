import { useState } from "react";
import type { Me } from "@/api/types";
import { Notice } from "@/components/Notice";
import { useAuth } from "@/features/auth/auth-context";
import { useI18n } from "@/hooks/use-i18n";
import { ROLE_LABEL } from "@/presenters/screens/users";
import { chooseLanguage } from "@/state/language";
import { C } from "@/styles/colors";
import { FORM } from "@/styles/form-styles";
import { MfaSection } from "./MfaSection";
import { PasswordSection } from "./PasswordSection";
import { SessionsSection } from "./SessionsSection";
import type { Flash } from "./use-security-action";

/**
 * "My settings", inside the workspace for every role: who I am, my language, two-step verification, my password, my
 * sessions, sign out. Everything here acts on the signed-in person only; organization-wide settings stay on their own screen.
 */
export function AccountScreen({ me, pad, title }: { me: Me; pad: string; title: string }) {
  const { i, lang } = useI18n();
  const auth = useAuth();
  const [flash, setFlash] = useState<Flash | null>(null);
  const sec = auth.security;

  const scope = me.scope === "all" ? i.S("allProjects") : i.S("nProjects", { n: me.scope.length });
  const rows: Array<[string, string, boolean?]> = [
    [i.S("acct_pName"), i.L(me.name)],
    [i.S("acct_pTitle"), i.L(me.title)],
    [i.S("acct_pRole"), i.L(ROLE_LABEL[me.role])],
    [i.S("acct_pEmail"), me.email, true],
    ...(me.employeeNo
      ? ([[i.S("acct_pEmployee"), me.employeeNo, true]] as Array<[string, string, boolean?]>)
      : []),
    [i.S("acct_pScope"), scope],
    ...(me.lastActiveAt
      ? ([[i.S("acct_pLast"), i.fd(me.lastActiveAt, "dt")]] as Array<[string, string, boolean?]>)
      : []),
  ];

  return (
    <div
      style={{
        padding: pad,
        maxWidth: 820,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{title}</h1>
        <div style={{ fontSize: 13, color: C.text.secondary }}>{i.S("acct_settingsSub")}</div>
      </div>

      <section style={FORM.card} aria-labelledby="acct-profile-h">
        <h2 id="acct-profile-h" style={FORM.sectionHeading}>
          {i.S("acct_profile")}
        </h2>
        <dl
          style={{
            margin: 0,
            display: "grid",
            gridTemplateColumns: "minmax(110px, 180px) minmax(0, 1fr)",
            gap: "8px 16px",
          }}
        >
          {rows.map(([k, v, ltr]) => (
            <div key={k} style={{ display: "contents" }}>
              <dt style={{ color: C.text.secondary, fontSize: 13 }}>{k}</dt>
              <dd style={{ margin: 0, overflowWrap: "anywhere" }} dir={ltr ? "ltr" : undefined}>
                {v}
              </dd>
            </div>
          ))}
        </dl>
        <span style={{ fontSize: 12.5, color: C.text.muted }}>{i.S("acct_profileNote")}</span>
      </section>

      <section style={FORM.card} aria-labelledby="acct-prefs-h">
        <h2 id="acct-prefs-h" style={FORM.sectionHeading}>
          {i.S("acct_prefs")}
        </h2>
        <span style={{ fontSize: 13, color: C.text.secondary }}>{i.S("acct_languageBody")}</span>
        <div
          role="group"
          aria-label={i.S("acct_language")}
          style={{
            display: "flex",
            alignSelf: "flex-start",
            border: `1px solid ${C.border.input}`,
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          {(
            [
              ["ar", "العربية"],
              ["en", "English"],
            ] as const
          ).map(([code, label]) => (
            <button
              key={code}
              aria-pressed={lang === code}
              onClick={() => chooseLanguage(code)}
              style={{
                border: 0,
                padding: "0 18px",
                height: 38,
                fontSize: 13.5,
                cursor: "pointer",
                background: lang === code ? C.text.ink : C.surface.white,
                color: lang === code ? C.surface.white : C.text.body,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {flash ? <Notice tone={flash.ok ? "success" : "danger"}>{flash.text}</Notice> : null}
      {sec ? (
        <>
          <MfaSection sec={sec} onChanged={auth.refreshSecurity} setFlash={setFlash} />
          <PasswordSection sec={sec} setFlash={setFlash} />
          <SessionsSection sec={sec} setFlash={setFlash} />
        </>
      ) : (
        <div role="status" style={FORM.card}>
          …
        </div>
      )}

      <section style={FORM.card} aria-labelledby="acct-out-h">
        <h2 id="acct-out-h" style={FORM.sectionHeading}>
          {i.S("acct_signOut")}
        </h2>
        <span style={{ fontSize: 13, color: C.text.secondary }}>{i.S("acct_signOutBody")}</span>
        <button
          style={{ ...FORM.ghostButton, alignSelf: "flex-start" }}
          onClick={() => auth.logout()}
        >
          {i.S("acct_signOut")}
        </button>
      </section>
    </div>
  );
}
