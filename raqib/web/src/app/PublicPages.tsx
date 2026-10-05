import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "@/config";
import { createI18n } from "@/i18n/i18n";
import type { PublicOnboardingInfo } from "@/api/types";
import { EMPTY_REQUEST, requestVM, setupVM, type RequestForm } from "@/presenters/public";
import { setUi, useUi } from "@/state/ui-store";
import { AccountRequestPublic } from "@/ui/generated/screens/AccountRequestPublic";
import { PasswordSetup } from "@/ui/generated/screens/PasswordSetup";

const go = (path: string) => window.location.assign(path);

/** Language switch shared by the public pages (they render before anyone signs in). */
function LangToggle({ lang }: { lang: "ar" | "en" }) {
  return (
    <button
      onClick={() => setUi({ lang: lang === "ar" ? "en" : "ar" })}
      style={{ position: "fixed", top: 12, insetInlineEnd: 12, height: 34, padding: "0 12px", border: "1px solid #D6D3CB", borderRadius: 4, background: "#fff", cursor: "pointer", zIndex: 5 }}
    >
      {lang === "ar" ? "English" : "العربية"}
    </button>
  );
}

/** `/request-account/:org` — the only page an anonymous person can use besides sign-in and password setup. */
export function PublicRequestPage({ org }: { org: string }) {
  const ui = useUi();
  const i = useMemo(() => createI18n(ui.lang), [ui.lang]);
  const [form, setForm] = useState<RequestForm>(EMPTY_REQUEST);
  const [info, setInfo] = useState<PublicOnboardingInfo | null>(null);
  const [missing, setMissing] = useState(false);
  const set = (p: Partial<RequestForm>) => setForm((f) => ({ ...f, ...p }));

  useEffect(() => {
    document.documentElement.lang = ui.lang;
    document.documentElement.dir = i.dir;
  }, [ui.lang, i.dir]);

  useEffect(() => {
    let live = true;
    fetch(`${API_BASE_URL}/raqib/public/onboarding/${encodeURIComponent(org)}`)
      .then((r) => (r.ok ? (r.json() as Promise<PublicOnboardingInfo>) : Promise.reject(new Error(String(r.status)))))
      .then((x) => live && setInfo(x))
      .catch(() => live && setMissing(true));
    return () => {
      live = false;
    };
  }, [org]);

  const submit = () => {
    set({ busy: true, submitErr: "" });
    fetch(`${API_BASE_URL}/raqib/public/onboarding/${encodeURIComponent(org)}/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), nationalId: form.nid.trim(), employeeNo: form.emp.trim(), department: form.dept.trim(),
        role: form.role, projects: (info?.projects ?? []).filter((p) => form.projects.includes(p.id)).map((p) => p.name.en).join(", "), justification: form.just.trim(), signature: form.sig.trim(), agree: form.agree,
      }),
    })
      .then(async (r) => {
        const body = (await r.json().catch(() => ({}))) as { ref?: string; error?: { code?: string; message?: string } };
        if (r.ok && body.ref) set({ doneRef: body.ref, busy: false });
        else set({ busy: false, submitErr: body.error?.code === "raqib.request_pending" ? i.S("req_pending") : r.status === 429 ? i.S("req_limited") : (body.error?.message ?? i.S("actionFailed")) });
      })
      .catch(() => set({ busy: false, submitErr: i.S("actionFailed") }));
  };

  const vm = { t: i.t, ...requestVM(i, form, set, info, submit, () => go("/")) };
  return (
    <div dir={i.dir} lang={ui.lang} style={{ minHeight: "100vh", fontFamily: "'IBM Plex Sans Arabic','IBM Plex Sans',system-ui,sans-serif", color: "#191C1F", fontSize: 14 }}>
      <LangToggle lang={ui.lang} />
      {missing ? <div style={{ padding: 48, textAlign: "center" }}>{i.S("req_inactive")}</div> : <AccountRequestPublic vm={vm} />}
    </div>
  );
}

/** `/reset-password?token=…` — set the password from the emailed link. */
export function PasswordSetupPage() {
  const ui = useUi();
  const i = useMemo(() => createI18n(ui.lang), [ui.lang]);
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [s, setS] = useState({ a: "", b: "", state: (token ? "valid" : "invalid") as "valid" | "used" | "invalid", busy: false });

  useEffect(() => {
    document.documentElement.lang = ui.lang;
    document.documentElement.dir = i.dir;
  }, [ui.lang, i.dir]);

  const submit = () => {
    setS((x) => ({ ...x, busy: true }));
    fetch(`${API_BASE_URL}/auth/password/reset`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password: s.a }) })
      .then((r) => setS((x) => ({ ...x, busy: false, state: r.ok ? "used" : "invalid" })))
      .catch(() => setS((x) => ({ ...x, busy: false })));
  };
  const vm = { t: { ...i.t, signInNow: i.t.signInNow }, ...setupVM(i, s, (p) => setS((x) => ({ ...x, ...p })), submit, () => go("/")) };
  return (
    <div dir={i.dir} lang={ui.lang} style={{ minHeight: "100vh", fontFamily: "'IBM Plex Sans Arabic','IBM Plex Sans',system-ui,sans-serif", color: "#191C1F", fontSize: 14 }}>
      <LangToggle lang={ui.lang} />
      <PasswordSetup vm={vm} />
      {s.state === "used" ? (
        <div style={{ textAlign: "center", paddingBottom: 32 }}>
          <button onClick={() => go("/")} style={{ height: 44, padding: "0 20px", border: 0, borderRadius: 4, background: "#0F5C4A", color: "#fff", cursor: "pointer" }}>{i.S("signInNow")}</button>
        </div>
      ) : null}
    </div>
  );
}
