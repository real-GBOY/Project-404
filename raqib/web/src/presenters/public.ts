import type { PublicOnboardingInfo } from "@/api/types";
import type { I18n } from "@/i18n/i18n";
import { C } from "@/styles/colors";

/** What the person has typed on the public account-request form. */
export interface RequestForm {
  step: 0 | 1 | 2;
  name: string; email: string; phone: string; nid: string; emp: string; dept: string; role: string; projects: string[]; just: string; sig: string; agree: boolean;
  /** Fields the person has tried to move past while invalid. */
  errs: string[];
  declErr: boolean;
  submitErr: string;
  busy: boolean;
  doneRef: string;
}

export const EMPTY_REQUEST: RequestForm = { step: 0, name: "", email: "", phone: "", nid: "", emp: "", dept: "", role: "", projects: [], just: "", sig: "", agree: false, errs: [], declErr: false, submitErr: "", busy: false, doneRef: "" };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Which fields are not good enough to continue. */
export function stepOneErrors(f: RequestForm): string[] {
  const e: string[] = [];
  if (f.name.trim().length < 3) e.push("name");
  if (!EMAIL.test(f.email.trim())) e.push("email");
  if (!/^[0-9+\s-]{7,20}$/.test(f.phone.trim())) e.push("phone");
  if (!/^[0-9]{10}$/.test(f.nid.trim())) e.push("nid");
  if (!f.role) e.push("role");
  if (f.just.trim().length < 10) e.push("just");
  return e;
}

export const signatureMatches = (f: RequestForm): boolean => f.sig.trim().length >= 3 && f.sig.trim().toLowerCase() === f.name.trim().toLowerCase();

/** The public request form (design: vmPublicRequest) as the three steps: details → declaration → review. */
export function requestVM(i: I18n, f: RequestForm, set: (p: Partial<RequestForm>) => void, info: PublicOnboardingInfo | null, submit: () => void, goLogin: () => void) {
  const bd = (k: string) => (f.errs.includes(k) ? C.status.danger.fg : C.border.input);
  const text = (k: keyof RequestForm) => (e: { target: { value: string } }) => set({ [k]: e.target.value, errs: f.errs.filter((x) => x !== k) } as Partial<RequestForm>);
  const roleLabel = (r: string) => i.S(`req_role_${r}`);
  const steps = [i.S("rs_details"), i.S("rs_declaration"), i.S("rs_review")].map((l, n) => ({ l: `${n + 1}. ${l}`, bd: f.step >= n ? C.brand.primary : C.border.input, fg: f.step >= n ? C.text.ink : C.text.muted }));
  const projNames = (info?.projects ?? []).filter((p) => f.projects.includes(p.id)).map((p) => i.L(p.name)).join("، ");
  const signedAt = i.fd(new Date().toISOString(), "dt");
  return {
    pub: {
      haveInvite: goLogin,
      notDone: !f.doneRef, done: !!f.doneRef, doneRef: f.doneRef, again: () => set({ ...EMPTY_REQUEST }),
      steps, s0: f.step === 0, s1: f.step === 1, s2: f.step === 2,
      f: { name: f.name, email: f.email, phone: f.phone, nid: f.nid, emp: f.emp, dept: f.dept, role: f.role, just: f.just, sig: f.sig },
      on: {
        name: text("name"), email: text("email"), phone: text("phone"), nid: text("nid"), emp: text("emp"), dept: text("dept"), role: text("role"), just: text("just"), sig: text("sig"),
        agree: (e: { target: { checked: boolean } }) => set({ agree: e.target.checked, declErr: false }),
      },
      bd: { name: bd("name"), email: bd("email"), phone: bd("phone"), nid: bd("nid"), dept: bd("dept"), role: bd("role"), just: bd("just"), projects: bd("projects"), sig: f.declErr && !signatureMatches(f) ? C.status.danger.fg : C.border.input },
      roleOpts: [{ v: "", l: i.S("choose") }].concat((info?.roles ?? []).map((r) => ({ v: r, l: roleLabel(r) }))),
      projChecks: (info?.projects ?? []).map((p) => ({ l: i.L(p.name), on: f.projects.includes(p.id), toggle: () => set({ projects: f.projects.includes(p.id) ? f.projects.filter((x) => x !== p.id) : [...f.projects, p.id] }) })),
      next1: () => {
        const errs = stepOneErrors(f);
        if (errs.length) set({ errs });
        else set({ step: 1, errs: [] });
      },
      back0: () => set({ step: 0 }),
      declVer: `v${info?.declarationVersion ?? ""}`,
      decl: [1, 2, 3, 4, 5].map((n) => ({ t: i.S(`decl_${n}`) })),
      agree: f.agree, declErr: f.declErr, sigDate: signedAt,
      next2: () => {
        if (!f.agree || !signatureMatches(f)) set({ declErr: true });
        else set({ step: 2, declErr: false });
      },
      back1: () => set({ step: 1 }),
      summary: [
        [i.S("f_name"), f.name], [i.S("f_email"), f.email], [i.S("f_phone"), f.phone], [i.S("f_nid"), f.nid.replace(/.(?=.{4})/g, "•")], [i.S("f_role"), f.role ? roleLabel(f.role) : "—"],
        [i.S("f_project"), projNames || "—"], [i.S("justification"), f.just], [i.S("declSigned"), f.sig],
      ].map(([k, v]) => ({ k, v })),
      submit, err: !!f.submitErr, errTxt: f.submitErr,
    },
  };
}

export const passwordRules = (a: string, b: string) => [
  { ok: a.length >= 12, key: "pw_len" }, { ok: /[A-Za-z]/.test(a) && /[0-9]/.test(a), key: "pw_mix" }, { ok: a.length > 0 && a === b, key: "pw_match" },
];

/** Password setup from the emailed link (design: vmSetup). The person chooses the password; nobody else ever sees it. */
export function setupVM(i: I18n, s: { a: string; b: string; state: "valid" | "used" | "invalid"; busy: boolean }, set: (p: Partial<{ a: string; b: string }>) => void, submit: () => void, toRequest: () => void) {
  const rules = passwordRules(s.a, s.b);
  const ok = rules.every((r) => r.ok);
  return {
    su: {
      valid: s.state === "valid", used: s.state === "used", invalid: s.state === "invalid",
      name: "", role: "", proj: "", email: "", expires: i.S("pw_expires"),
      a: s.a, b: s.b, onA: (e: { target: { value: string } }) => set({ a: e.target.value }), onB: (e: { target: { value: string } }) => set({ b: e.target.value }),
      rules: rules.map((r) => ({ l: i.S(r.key), mark: r.ok ? "✓" : "○" })),
      mfa: i.S("pw_note"), notOk: !ok || s.busy, bg: ok ? C.brand.primary : C.brand.primaryMuted, submit, toRequest,
    },
  };
}
