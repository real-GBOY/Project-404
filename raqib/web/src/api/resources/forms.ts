import { API_BASE_URL, ENDPOINTS } from "@/config";
import { http } from "@/services/http";
import type { Form, FormSection } from "../types";

export const formsApi = {
  /** A blank, print-ready copy of a form, fetched with the caller's credentials. The browser makes the PDF. */
  blankHtml: async (id: string, lang: "ar" | "en"): Promise<string> => {
    const r = await fetch(`${API_BASE_URL}${ENDPOINTS.forms.blank(id, lang)}`, {
      headers: http.bearerHeaders(),
    });
    if (!r.ok) throw Object.assign(new Error(`form ${r.status}`), { status: r.status });
    return r.text();
  },
  list: () => http<{ items: Form[] }>(ENDPOINTS.forms.list).then((r) => r.items),
  create: (b: { code: string; category: "site" | "guard"; name: { ar: string; en: string } }) =>
    http<Form>(ENDPOINTS.forms.list, { method: "POST", body: b }),
  createDraft: (id: string) => http<Form>(ENDPOINTS.forms.versions(id), { method: "POST" }),
  saveDraft: (id: string, sections: FormSection[]) =>
    http<Form>(ENDPOINTS.forms.draft(id), { method: "PUT", body: { sections } }),
  rename: (id: string, name: { ar: string; en: string }) =>
    http<Form>(ENDPOINTS.forms.byId(id), { method: "PATCH", body: { name } }),
  discardDraft: (id: string) => http<Form>(ENDPOINTS.forms.draft(id), { method: "DELETE" }),
  publish: (id: string, reason: string) =>
    http<Form>(ENDPOINTS.forms.publish(id), { method: "POST", body: { reason } }),
  setActive: (id: string, active: boolean, reason: string) =>
    http<Form>(ENDPOINTS.forms.active(id), { method: "POST", body: { active, reason } }),
};
