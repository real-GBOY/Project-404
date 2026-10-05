import { useEffect, useState } from "react";
import { api } from "@/api";
import type { PublicOnboardingInfo } from "@/api/types";
import { useI18n } from "@/hooks/use-i18n";
import { ApiError } from "@/services/http";
import { EMPTY_REQUEST, type RequestForm } from "@/presenters/public";

/** The public account-request form: the organization's options, the person's answers, and submitting them. */
export function usePublicRequest(org: string) {
  const { i } = useI18n();
  const [form, setForm] = useState<RequestForm>(EMPTY_REQUEST);
  const [info, setInfo] = useState<PublicOnboardingInfo | null>(null);
  const [missing, setMissing] = useState(false);
  const set = (p: Partial<RequestForm>) => setForm((f) => ({ ...f, ...p }));

  useEffect(() => {
    let live = true;
    api.public
      .onboardingInfo(org)
      .then((x) => live && setInfo(x))
      .catch(() => live && setMissing(true));
    return () => {
      live = false;
    };
  }, [org]);

  const submit = () => {
    set({ busy: true, submitErr: "" });
    api.public
      .submitRequest(org, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        nationalId: form.nid.trim(),
        employeeNo: form.emp.trim(),
        department: form.dept.trim(),
        role: form.role,
        projects: (info?.projects ?? [])
          .filter((p) => form.projects.includes(p.id))
          .map((p) => p.name.en)
          .join(", "),
        justification: form.just.trim(),
        signature: form.sig.trim(),
        agree: form.agree,
      })
      .then((r) => set({ doneRef: r.ref, busy: false }))
      .catch((err: unknown) => {
        const text =
          err instanceof ApiError
            ? err.code === "raqib.request_pending"
              ? i.S("req_pending")
              : err.status === 429
                ? i.S("req_limited")
                : err.message
            : i.S("actionFailed");
        set({ busy: false, submitErr: text });
      });
  };
  return { form, set, info, missing, submit };
}
